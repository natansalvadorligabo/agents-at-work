/**
 * Repeating timer, injected so tests can drive it by hand.
 * @typedef {object} IntervalTimer
 * @property {(ms: number, callback: () => void) => () => void} every Returns a function that cancels the timer.
 */

/**
 * `setInterval`-based timer; works in Node and in the browser.
 * @type {IntervalTimer}
 * @example const cancel = systemIntervalTimer.every(1000, refresh)
 */
export const systemIntervalTimer = {
  every(ms, callback) {
    const handle = setInterval(callback, ms)
    return () => clearInterval(handle)
  },
}
