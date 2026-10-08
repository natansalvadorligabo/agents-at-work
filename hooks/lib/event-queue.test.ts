import { describe, expect, test } from 'claude-code/testing'
import { EventQueue } from './event-queue.js'

describe('EventQueue', () => {
  test('stamps the session envelope on every event', async () => {
    const queue = new EventQueue(() => 1000)
    queue.identify('s1', 'shop')
    queue.enqueue({ type: 'turn.start', agentId: 'main' })
    expect(queue.takeBatch()).toEqual([
      { type: 'turn.start', agentId: 'main', sessionId: 's1', project: 'shop', timestamp: 1000 },
    ])
  })

  test('hands out batches in order of at most 50 events', async () => {
    const queue = new EventQueue(() => 0)
    for (let i = 0; i < 60; i++) queue.enqueue({ type: 'tool.start', toolUseId: String(i) })
    expect(queue.takeBatch()?.length).toBe(50)
    expect(queue.takeBatch()?.[0]?.toolUseId).toBe('50')
    expect(queue.takeBatch()).toBe(null)
  })

  test('lets only one flusher drain at a time', async () => {
    const queue = new EventQueue(() => 0)
    expect(queue.beginFlush()).toBe(true)
    expect(queue.beginFlush()).toBe(false)
    queue.endFlush()
    expect(queue.beginFlush()).toBe(true)
  })
})
