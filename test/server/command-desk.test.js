import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CommandDesk, NO_ANSWER, NOT_PICKED_UP } from '../../server/command-desk.js'
import { FakeClock } from '../fakes/fake-clock.js'

/** @param {string} id */
const prompt = id => /** @type {const} */ ({ id, kind: 'prompt', agentId: 'main', text: 'hi' })

describe('CommandDesk', () => {
  it('wakes a waiting plugin as soon as the page submits', async () => {
    const desk = new CommandDesk({ timeouts: new FakeClock() })
    const taking = desk.take('s1', 25000)
    void desk.submit('s1', prompt('c1'))
    assert.deepEqual(await taking, [prompt('c1')])
  })

  it('hands each command over once and only to its session', async () => {
    const desk = new CommandDesk({ timeouts: new FakeClock() })
    void desk.submit('s1', prompt('c1'))
    void desk.submit('s2', prompt('c2'))
    assert.deepEqual(await desk.take('s1', 1), [prompt('c1')])
    const clock = new FakeClock()
    const later = new CommandDesk({ timeouts: clock })
    const empty = later.take('s1', 1000)
    await clock.advance(1000)
    assert.deepEqual(await empty, [])
  })

  it('resolves the page with the reported outcome', async () => {
    const desk = new CommandDesk({ timeouts: new FakeClock() })
    const outcome = desk.submit('s1', prompt('c1'))
    await desk.take('s1', 1)
    assert.ok(desk.report('c1', { ok: false, error: 'busy' }))
    assert.deepEqual(await outcome, { ok: false, error: 'busy' })
    assert.ok(!desk.report('c1', { ok: true }))
  })

  it('tells the page whether the session never took the command or never answered', async () => {
    const clock = new FakeClock()
    const desk = new CommandDesk({ timeouts: clock })
    const untaken = desk.submit('s1', prompt('c1'))
    await clock.advance(20000)
    assert.deepEqual(await untaken, { ok: false, error: NOT_PICKED_UP })
    const unanswered = desk.submit('s1', prompt('c2'))
    await desk.take('s1', 1)
    await clock.advance(20000)
    assert.deepEqual(await unanswered, { ok: false, error: NO_ANSWER })
  })
})
