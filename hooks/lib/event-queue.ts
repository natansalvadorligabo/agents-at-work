import type { OfficeEvent } from '../../shared/protocol.js'

const MAX_BATCH_SIZE = 50

/** An event before the queue stamps the session envelope on it. */
export type OutgoingEvent = Omit<OfficeEvent, 'sessionId' | 'project' | 'timestamp'>

/**
 * Ordered queue of hook events waiting to be posted, with a single-flusher guard.
 * It never touches `$`: the engine only lets hook code pass `$` to plain functions.
 * @example
 * queue.enqueue({ type: 'turn.start', agentId: 'main' })
 * if (queue.beginFlush()) for (let b = queue.takeBatch(); b; b = queue.takeBatch()) await send(b)
 */
export class EventQueue {
  #events: OfficeEvent[] = []
  #flushing = false
  #sessionId = ''
  #project = ''
  readonly #now: () => number

  constructor(now: () => number) {
    this.#now = now
  }

  /** Sets the session envelope stamped on every later event. */
  identify(sessionId: string, project: string): void {
    this.#sessionId = sessionId
    this.#project = project
  }

  enqueue(event: OutgoingEvent): void {
    this.#events.push({
      ...event,
      sessionId: this.#sessionId,
      project: this.#project,
      timestamp: this.#now(),
    })
  }

  /** Claims the flusher role; false when another flush is already draining the queue. */
  beginFlush(): boolean {
    if (this.#flushing) return false
    this.#flushing = true
    return true
  }

  endFlush(): void {
    this.#flushing = false
  }

  /** Removes and returns the next batch in order, or null when the queue is empty. */
  takeBatch(): OfficeEvent[] | null {
    if (this.#events.length === 0) return null
    return this.#events.splice(0, MAX_BATCH_SIZE)
  }

  get pendingCount(): number {
    return this.#events.length
  }
}
