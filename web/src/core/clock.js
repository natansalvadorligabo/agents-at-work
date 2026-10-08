/**
 * Time source for the whole web app. Epoch-based on purpose: tool timestamps from the server are epoch
 * milliseconds and the coffee rules compare them against "now".
 * @typedef {object} Clock
 * @property {() => number} now
 *
 * Deferred work. Injected so tests can advance time instead of sleeping.
 * @typedef {object} Scheduler
 * @property {(ms: number) => Promise<void>} wait
 * @property {(ms: number, callback: () => void) => void} after
 *
 * Uniform random number in [0, 1).
 * @typedef {() => number} RandomSource
 */

/** @type {Clock} */
export const systemClock = { now: () => Date.now() }

/** @type {Scheduler} */
export const systemScheduler = {
  wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
  after: (ms, callback) => void setTimeout(callback, ms),
}

/** @type {RandomSource} */
export const systemRandom = () => Math.random()

/**
 * Picks one element uniformly at random.
 * @template T
 * @param {readonly T[]} items
 * @param {RandomSource} random
 * @returns {T}
 * @example pickRandom(['a', 'b'], Math.random)
 */
export function pickRandom(items, random) {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined)
    throw new RangeError(`Cannot pick from ${JSON.stringify(items)}; expected a non-empty array`)
  return item
}
