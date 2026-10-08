import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PermissionDesk } from '../../server/permission-desk.js'
import { FakeClock } from '../fakes/fake-clock.js'

function createDesk() {
  const clock = new FakeClock()
  const desk = new PermissionDesk({ timeouts: clock })
  desk.open('r1', { sessionId: 's1', agentId: 'a1' })
  return { clock, desk }
}

describe('PermissionDesk', () => {
  it('wakes a waiting plugin as soon as the page decides', async () => {
    const { desk } = createDesk()
    const waiting = desk.waitFor('r1', 20000)
    assert.ok(desk.decide('r1', 'allow'))
    assert.equal(await waiting, 'allow')
  })

  it('keeps the first decision', async () => {
    const { desk } = createDesk()
    desk.decide('r1', 'deny')
    assert.ok(!desk.decide('r1', 'allow'))
    assert.equal(await desk.waitFor('r1', 10), 'deny')
  })

  it('answers pending when the wait runs out, capped at 30 s', async () => {
    const { clock, desk } = createDesk()
    const waiting = desk.waitFor('r1', 999999)
    await clock.advance(30000)
    assert.equal(await waiting, 'pending')
  })

  it('expires waits on close and unknown requests', async () => {
    const { desk } = createDesk()
    const waiting = desk.waitFor('r1', 20000)
    desk.close('r1')
    assert.equal(await waiting, 'expired')
    assert.equal(await desk.waitFor('nope', 1), 'expired')
    assert.equal(desk.ownerOf('r1'), null)
  })
})
