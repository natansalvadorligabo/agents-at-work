import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { StreamHub, formatServerSentEvent } from '../../server/stream-hub.js'
import { FakeClock } from '../fakes/fake-clock.js'
import { FakeServerResponse } from '../fakes/fake-http.js'

describe('formatServerSentEvent', () => {
  it('writes the event name and JSON data', () => {
    assert.equal(formatServerSentEvent('update', { a: 1 }), 'event: update\ndata: {"a":1}\n\n')
  })
})

describe('StreamHub', () => {
  it('sends the initial message, then broadcasts to every subscriber', () => {
    const hub = new StreamHub({ timer: new FakeClock() })
    const [first, second] = [new FakeServerResponse(), new FakeServerResponse()]
    hub.subscribe(first, 'snapshot', null)
    hub.subscribe(second, 'snapshot', null)
    hub.broadcast('update', { n: 1 })
    assert.equal(first.body, 'event: snapshot\ndata: null\n\nevent: update\ndata: {"n":1}\n\n')
    assert.equal(hub.subscriberCount, 2)
  })

  it('keeps connections alive and forgets closed ones', async () => {
    const clock = new FakeClock()
    const hub = new StreamHub({ timer: clock })
    const response = new FakeServerResponse()
    hub.subscribe(response, 'snapshot', null)
    await clock.advance(15000)
    assert.ok(response.body.endsWith(': alive\n\n'))
    response.emit('close')
    assert.equal(hub.subscriberCount, 0)
    assert.equal(clock.pendingTimers, 0)
  })
})
