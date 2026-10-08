import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAgentSnapshot } from '../../shared/agent-snapshot.js'
import { systemIntervalTimer } from '../../shared/interval-timer.js'
import { EventType, MAIN_AGENT_ID, isMainAgent } from '../../shared/protocol.js'

describe('createAgentSnapshot', () => {
  it('starts the main agent waiting and subagents working', () => {
    assert.equal(createAgentSnapshot(MAIN_AGENT_ID, {}, 0).status, 'waiting')
    assert.equal(createAgentSnapshot(MAIN_AGENT_ID, {}, 0).agentType, 'main')
    const sub = createAgentSnapshot('a1', { agentType: 'Explore', parentId: 'main' }, 9)
    assert.deepEqual(
      [sub.status, sub.agentType, sub.parentId, sub.createdAt],
      ['working', 'Explore', 'main', 9],
    )
  })
})

describe('protocol', () => {
  it('uses English dotted event names', () => {
    assert.ok(Object.values(EventType).every(type => /^[a-z]+\.[a-z]+$/.test(type)))
    assert.ok(isMainAgent({ id: 'main' }))
    assert.ok(!isMainAgent({ id: 'a1' }))
  })
})

describe('systemIntervalTimer', () => {
  it('fires until cancelled', async () => {
    let ticks = 0
    const cancel = systemIntervalTimer.every(1, () => ticks++)
    await new Promise(resolve => setTimeout(resolve, 15))
    cancel()
    const settled = ticks
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.ok(settled > 0)
    assert.equal(ticks, settled)
  })
})
