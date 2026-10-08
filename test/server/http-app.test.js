import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRequestListener } from '../../server/http-app.js'
import { SessionStore } from '../../server/session-store.js'
import { StaticFiles } from '../../server/static-files.js'
import { StreamHub } from '../../server/stream-hub.js'
import { FakeClock } from '../fakes/fake-clock.js'
import { FakeFileReader } from '../fakes/fake-file-reader.js'
import { FakeIncomingRequest, FakeServerResponse } from '../fakes/fake-http.js'

function createApp() {
  const errors = /** @type {string[]} */ ([])
  const hub = new StreamHub({ timer: new FakeClock() })
  const staticFiles = new StaticFiles({
    mounts: [{ urlPrefix: '/', directory: '/web' }],
    reader: new FakeFileReader({ '/web/index.html': 'hi' }),
  })
  const listener = createRequestListener({
    store: new SessionStore({ now: () => 1 }),
    hub,
    staticFiles,
    now: () => 1,
    logError: message => errors.push(message),
  })
  /** @param {string} method @param {string} url @param {string} [body] */
  const request = async (method, url, body = '') => {
    const response = new FakeServerResponse()
    const incoming = new FakeIncomingRequest({ method, url }).send(body)
    await listener(/** @type {any} */ (incoming), /** @type {any} */ (response))
    return response
  }
  return { request, hub, errors }
}

describe('createRequestListener', () => {
  it('answers the health check', async () => {
    const { request } = createApp()
    const response = await request('GET', '/health')
    assert.equal(response.statusCode, 200)
    assert.equal(response.body, '{"ok":true}')
  })

  it('applies posted events and broadcasts them to open streams', async () => {
    const { request } = createApp()
    const stream = await request('GET', '/stream?session=s1')
    const posted = await request(
      'POST',
      '/events',
      JSON.stringify([{ type: 'turn.start', sessionId: 's1', agentId: 'main' }]),
    )
    assert.equal(posted.statusCode, 204)
    assert.match(stream.body, /^event: snapshot\ndata: null/)
    assert.match(
      stream.body,
      /event: update\ndata: \{"event":\{"project":"","timestamp":1,"type":"turn.start"/,
    )
    assert.match(stream.body, /"status":"working"/)
  })

  it('answers 400 with the validation message for bad events, without logging them', async () => {
    const { request, errors } = createApp()
    const response = await request('POST', '/events', '{"type":"x","sessionId":"s"}')
    assert.equal(response.statusCode, 400)
    assert.match(response.body, /Unknown event type "x"/)
    assert.deepEqual(errors, [])
  })

  it('serves static files and refuses other methods', async () => {
    const { request } = createApp()
    assert.equal((await request('GET', '/')).body, 'hi')
    assert.equal((await request('DELETE', '/')).statusCode, 405)
  })
})
