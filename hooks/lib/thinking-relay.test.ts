import { describe, expect, test } from 'claude-code/testing'
import { ThinkingRelay } from './thinking-relay.js'

class FakeClock {
  now = 0
  readonly read = () => this.now
}

describe('ThinkingRelay', () => {
  test('emits start, delta and end around a thinking block', async () => {
    const clock = new FakeClock()
    clock.now = 1000
    const relay = new ThinkingRelay('main', clock.read)
    const events = [...relay.onChunk('thinking', 'hmm'), ...relay.onChunk('text', 'answer')]
    expect(events.map(event => event.type)).toEqual(['thinking.start', 'thinking.delta', 'thinking.end'])
    expect(events[1]?.text).toBe('hmm')
  })

  test('throttles deltas and flushes the remainder on finish', async () => {
    const clock = new FakeClock()
    clock.now = 1000
    const relay = new ThinkingRelay('main', clock.read)
    const events = [...relay.onChunk('thinking', 'a'), ...relay.onChunk('thinking', 'b'), ...relay.finish()]
    const deltas = events.filter(event => event.type === 'thinking.delta').map(event => event.text)
    expect(deltas).toEqual(['a', 'b'])
  })

  test('ignores engine chunks and finishing twice', async () => {
    const relay = new ThinkingRelay('main', new FakeClock().read)
    const events = [...relay.onChunk('engine', ''), ...relay.finish(), ...relay.finish()]
    expect(events.length).toBe(0)
  })
})
