import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ControlKeys } from '../../server/control-keys.js'
import { createRequestListener } from '../../server/http-app.js'
import { PermissionDesk } from '../../server/permission-desk.js'
import { SessionStore } from '../../server/session-store.js'
import { StaticFiles } from '../../server/static-files.js'
import { StreamHub } from '../../server/stream-hub.js'
import { FakeClock } from '../fakes/fake-clock.js'
import { FakeFileReader } from '../fakes/fake-file-reader.js'
import { FakeIncomingRequest, FakeServerResponse } from '../fakes/fake-http.js'

const HOST = '127.0.0.1:47821'
// What Node's fetch sends: Sec-Fetch-Mode, but no Origin and no Sec-Fetch-Site.
const PLUGIN = { host: HOST, 'sec-fetch-mode': 'cors' }
const PAGE = { host: HOST, origin: `http://${HOST}`, 'sec-fetch-site': 'same-origin' }
const KEY = 'k'.repeat(40)

function createApp() {
  const clock = new FakeClock()
  const errors = /** @type {string[]} */ ([])
  const hub = new StreamHub({ timer: clock })
  const staticFiles = new StaticFiles({
    mounts: [{ urlPrefix: '/', directory: '/web' }],
    reader: new FakeFileReader({ '/web/index.html': 'hi' }),
  })
  const store = new SessionStore({ now: () => 1 })
  const desk = new PermissionDesk({ timeouts: clock })
  const listener = createRequestListener({
    store,
    hub,
    desk,
    keys: new ControlKeys(),
    staticFiles,
    port: 47821,
    now: () => 1,
    logError: message => errors.push(message),
  })
  /**
   * @param {string} method @param {string} url
   * @param {{ body?: string, headers?: Record<string, string> }} [options]
   */
  const request = async (method, url, { body = '', headers = PLUGIN } = {}) => {
    const response = new FakeServerResponse()
    const incoming = new FakeIncomingRequest({ method, url, headers }).send(body)
    await listener(/** @type {any} */ (incoming), /** @type {any} */ (response))
    return response
  }
  return { request, hub, errors, clock, store }
}

/** @param {ReturnType<typeof createApp>} app */
async function openRequest(app) {
  await app.request('POST', '/control/register', { body: JSON.stringify({ sessionId: 's1', key: KEY }) })
  await app.request('GET', '/stream?session=s1', { headers: PAGE })
  const body = JSON.stringify({
    sessionId: 's1',
    agentId: 'main',
    requestId: 'toolu_1',
    tool: 'Bash',
    summary: 'npm i',
    reason: 'asks',
  })
  return app.request('POST', '/permissions', { body })
}

describe('createRequestListener: basics', () => {
  it('answers the health check', async () => {
    const response = await createApp().request('GET', '/health')
    assert.equal(response.body, '{"ok":true}')
  })

  it('applies posted events and broadcasts them to open streams', async () => {
    const { request } = createApp()
    const stream = await request('GET', '/stream?session=s1', { headers: PAGE })
    const posted = await request('POST', '/events', {
      body: JSON.stringify([{ type: 'turn.start', sessionId: 's1' }]),
    })
    assert.equal(posted.statusCode, 204)
    assert.match(stream.body, /^event: snapshot\ndata: null/)
    assert.match(stream.body, /"status":"working"/)
  })

  it('answers 400 with the validation message for bad events, without logging them', async () => {
    const { request, errors } = createApp()
    const response = await request('POST', '/events', { body: '{"type":"x","sessionId":"s"}' })
    assert.equal(response.statusCode, 400)
    assert.match(response.body, /Unknown event type "x"/)
    assert.deepEqual(errors, [])
  })

  it('serves static files and refuses unknown methods', async () => {
    const { request } = createApp()
    assert.equal((await request('GET', '/', { headers: PAGE })).body, 'hi')
    assert.equal((await request('PUT', '/')).statusCode, 405)
  })
})

describe('createRequestListener: security', () => {
  it('refuses foreign host names (DNS rebinding)', async () => {
    const response = await createApp().request('GET', '/health', { headers: { host: 'evil.example:47821' } })
    assert.equal(response.statusCode, 403)
  })

  it('refuses requests from other sites', async () => {
    const headers = { host: HOST, origin: 'https://evil.example', 'sec-fetch-mode': 'cors' }
    const response = await createApp().request('GET', '/stream', { headers })
    assert.equal(response.statusCode, 403)
  })

  it('keeps plugin-only routes away from browsers, even the office page', async () => {
    const { request } = createApp()
    const body = JSON.stringify({ sessionId: 's1', key: KEY })
    assert.equal((await request('POST', '/control/register', { body, headers: PAGE })).statusCode, 403)
    assert.equal((await request('POST', '/events', { body: '[]', headers: PAGE })).statusCode, 403)
  })

  it('refuses weak control keys', async () => {
    const response = await createApp().request('POST', '/control/register', {
      body: '{"sessionId":"s1","key":"short"}',
    })
    assert.equal(response.statusCode, 400)
    assert.match(response.body, /too weak/)
  })

  it('refuses a decision without the session control key', async () => {
    const app = createApp()
    await openRequest(app)
    const body = '{"decision":"allow"}'
    const response = await app.request('POST', '/permissions/toolu_1/decision', {
      body,
      headers: { ...PAGE, 'x-agents-at-work-key': 'x'.repeat(40) },
    })
    assert.equal(response.statusCode, 403)
  })
})

describe('createRequestListener: permissions', () => {
  it('raises the agent hand and reports how many pages watch', async () => {
    const app = createApp()
    const opened = await openRequest(app)
    assert.deepEqual(JSON.parse(opened.body), { watchers: 1 })
    assert.equal(app.store.snapshot('s1')?.agents[0]?.pendingPermission?.tool, 'Bash')
  })

  it('hands the page decision to the waiting plugin', async () => {
    const app = createApp()
    await openRequest(app)
    const waiting = app.request('GET', '/permissions/toolu_1?waitMs=20000')
    const headers = { ...PAGE, 'x-agents-at-work-key': KEY }
    const decided = await app.request('POST', '/permissions/toolu_1/decision', {
      body: '{"decision":"deny"}',
      headers,
    })
    assert.equal(decided.statusCode, 204)
    assert.deepEqual(JSON.parse((await waiting).body), { decision: 'deny', watchers: 1 })
    assert.equal(app.store.snapshot('s1')?.agents[0]?.pendingPermission, null)
  })

  it('answers pending after the wait and expires withdrawn requests', async () => {
    const app = createApp()
    await openRequest(app)
    const waiting = app.request('GET', '/permissions/toolu_1?waitMs=1000')
    await app.clock.advance(1000)
    assert.equal(JSON.parse((await waiting).body).decision, 'pending')
    assert.equal((await app.request('DELETE', '/permissions/toolu_1')).statusCode, 204)
    assert.equal(app.store.snapshot('s1')?.agents[0]?.pendingPermission, null)
  })
})
