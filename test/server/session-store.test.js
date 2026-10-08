import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SessionStore } from '../../server/session-store.js'
import { officeEvent } from '../fakes/builders.js'

function createStore() {
  return new SessionStore({ now: () => 500 })
}

describe('SessionStore', () => {
  it('creates a session with a waiting main agent on its first event', () => {
    const store = createStore()
    assert.equal(store.apply(officeEvent({ type: 'session.start' })), null)
    const snapshot = store.snapshot('s1')
    assert.equal(snapshot?.project, 'shop')
    assert.deepEqual(
      snapshot?.agents.map(agent => [agent.id, agent.status]),
      [['main', 'waiting']],
    )
  })

  it('tracks turns, tools and their failures', () => {
    const store = createStore()
    store.apply(officeEvent({ type: 'turn.start', agentId: 'main' }))
    store.apply(
      officeEvent({
        type: 'tool.start',
        agentId: 'main',
        toolUseId: 'u1',
        tool: 'Bash',
        summary: 'npm test',
        timestamp: 10,
      }),
    )
    const agent = store.apply(
      officeEvent({ type: 'tool.end', agentId: 'main', toolUseId: 'u1', failed: true, timestamp: 30 }),
    )
    assert.equal(agent?.status, 'working')
    assert.deepEqual(agent?.activeTools, {})
    assert.deepEqual(agent?.history[0], {
      id: 'u1',
      tool: 'Bash',
      summary: 'npm test',
      startedAt: 10,
      endedAt: 30,
      failed: true,
    })
    assert.equal(store.apply(officeEvent({ type: 'turn.end', agentId: 'main' }))?.status, 'waiting')
  })

  it('keeps history and prompt when a subagent is re-announced', () => {
    const store = createStore()
    store.apply(
      officeEvent({
        type: 'agent.spawned',
        agentId: 'a1',
        parentId: 'main',
        description: 'Fix it',
        prompt: 'Do X',
      }),
    )
    store.apply(officeEvent({ type: 'tool.start', agentId: 'a1', toolUseId: 'u1', tool: 'Read' }))
    const agent = store.apply(officeEvent({ type: 'agent.spawned', agentId: 'a1', restored: true }))
    assert.equal(agent?.prompt, 'Do X')
    assert.equal(agent?.description, 'Fix it')
    assert.equal(agent?.history.length, 1)
  })

  it('drops finished agents from snapshots', () => {
    const store = createStore()
    store.apply(officeEvent({ type: 'agent.spawned', agentId: 'a1' }))
    const agent = store.apply(
      officeEvent({ type: 'agent.finished', agentId: 'a1', reason: 'error', answer: 'nope' }),
    )
    assert.equal(agent?.status, 'failed')
    assert.deepEqual(
      store.snapshot('s1')?.agents.map(a => a.id),
      ['main'],
    )
  })

  it('accumulates thinking text and caps it', () => {
    const store = createStore()
    store.apply(officeEvent({ type: 'thinking.start', agentId: 'main' }))
    store.apply(officeEvent({ type: 'thinking.delta', agentId: 'main', text: 'x'.repeat(13000) }))
    const agent = store.apply(officeEvent({ type: 'thinking.end', agentId: 'main' }))
    assert.equal(agent?.thinking, false)
    assert.equal(agent?.thoughts.length, 12000)
  })

  it('caps the tool history at 150 records', () => {
    const store = createStore()
    for (let i = 0; i < 160; i++)
      store.apply(officeEvent({ type: 'tool.start', toolUseId: `u${i}`, tool: 'Read' }))
    assert.equal(store.snapshot('s1')?.agents[0]?.history.length, 150)
  })

  it('falls back to the latest session and reports session info', () => {
    const store = createStore()
    store.apply(officeEvent({ type: 'session.start', sessionId: 'old' }))
    store.apply(officeEvent({ type: 'session.end', sessionId: 'new' }))
    assert.equal(store.snapshot('unknown')?.id, 'new')
    assert.deepEqual(store.info('new'), { id: 'new', project: 'shop', ended: true })
    assert.equal(store.info('missing'), null)
  })

  it('has no snapshot before any event', () => {
    assert.equal(createStore().snapshot(null), null)
  })
})
