import { EventType } from '../../shared/protocol.js'
import type { OutgoingEvent } from './event-queue.js'

const SEND_INTERVAL_MS = 300

/**
 * Turns a step's streamed thinking chunks into start / delta / end events, throttling the deltas.
 * Returns the events instead of sending them, so hook code stays the only place that touches `$`.
 * @example
 * const relay = new ThinkingRelay('main', Date.now)
 * for (const event of relay.onChunk('thinking', 'Let me check…')) publish($, event)
 */
export class ThinkingRelay {
  #thinking = false
  #pending = ''
  #lastSentAt = 0
  readonly #agentId: string
  readonly #now: () => number

  constructor(agentId: string, now: () => number) {
    this.#agentId = agentId
    this.#now = now
  }

  /** Feeds one streamed chunk; any non-thinking, non-engine chunk closes the thinking block. */
  onChunk(kind: string, text: string): OutgoingEvent[] {
    if (kind === 'thinking') return this.#appendThinking(text)
    return kind === 'engine' ? [] : this.finish()
  }

  /** Flushes pending text and closes the thinking block if one is open. */
  finish(): OutgoingEvent[] {
    if (!this.#thinking) return []
    this.#thinking = false
    return [...this.#flushPending(), { type: EventType.THINKING_END, agentId: this.#agentId }]
  }

  #appendThinking(text: string): OutgoingEvent[] {
    const events: OutgoingEvent[] = []
    if (!this.#thinking) events.push({ type: EventType.THINKING_START, agentId: this.#agentId })
    this.#thinking = true
    this.#pending += text
    if (this.#now() - this.#lastSentAt >= SEND_INTERVAL_MS) events.push(...this.#flushPending())
    return events
  }

  #flushPending(): OutgoingEvent[] {
    if (this.#pending === '') return []
    const delta: OutgoingEvent = {
      type: EventType.THINKING_DELTA,
      agentId: this.#agentId,
      text: this.#pending,
    }
    this.#pending = ''
    this.#lastSentAt = this.#now()
    return [delta]
  }
}
