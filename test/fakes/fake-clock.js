/**
 * Manual clock and scheduler: time only moves when a test calls `advance`.
 * Implements Clock, Scheduler and IntervalTimer.
 */
export class FakeClock {
  /** @type {{ at: number, callback: () => void, every: number }[]} */
  #timers = []

  /** @param {number} [start] */
  constructor(start = 1_000_000) {
    this.current = start
  }

  now = () => this.current

  /** @param {number} ms */
  wait = ms => new Promise(resolve => this.after(ms, () => resolve(undefined)))

  /** @param {number} ms @param {() => void} callback */
  after = (ms, callback) => {
    this.#timers.push({ at: this.current + ms, callback, every: 0 })
  }

  /** @param {number} ms @param {() => void} callback */
  every = (ms, callback) => {
    const timer = { at: this.current + ms, callback, every: ms }
    this.#timers.push(timer)
    return () => {
      this.#timers = this.#timers.filter(other => other !== timer)
    }
  }

  get pendingTimers() {
    return this.#timers.length
  }

  /**
   * Moves time forward, firing due timers in order and letting promise callbacks run between them.
   * @param {number} ms
   */
  async advance(ms) {
    const end = this.current + ms
    for (let timer = this.#nextDue(end); timer; timer = this.#nextDue(end)) {
      this.current = timer.at
      this.#fire(timer)
      await flushMicrotasks()
    }
    this.current = end
    await flushMicrotasks()
  }

  /** @param {number} end */
  #nextDue(end) {
    const due = this.#timers.filter(timer => timer.at <= end).sort((a, b) => a.at - b.at)
    return due[0] ?? null
  }

  /** @param {{ at: number, callback: () => void, every: number }} timer */
  #fire(timer) {
    if (timer.every > 0) timer.at += timer.every
    else this.#timers = this.#timers.filter(other => other !== timer)
    timer.callback()
  }
}

/** Lets already-resolved promise chains run to completion. */
export async function flushMicrotasks() {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

/**
 * A random source that replays a fixed sequence.
 * @param {number[]} values
 * @returns {() => number}
 */
export function sequenceRandom(values) {
  let index = 0
  return () => values[index++ % values.length] ?? 0
}
