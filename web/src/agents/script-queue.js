/**
 * Runs an agent's scripted scenes (arriving, delivering, leaving, spilling coffee) one after another.
 * While a script runs, the agent's free activity is paused.
 * @example
 * const scripts = new ScriptQueue({ onStart: () => leaveCoffee(), logError: console.error })
 * await scripts.enqueue(async () => { await walkTo(door) })
 */
export class ScriptQueue {
  #tail = Promise.resolve()
  #running = false
  #onStart
  #logError

  /** @param {{ onStart: () => void, logError: (message: string, error: unknown) => void }} dependencies */
  constructor({ onStart, logError }) {
    this.#onStart = onStart
    this.#logError = logError
  }

  get isRunning() {
    return this.#running
  }

  /**
   * @param {() => Promise<void>} script
   * @returns {Promise<void>} Settles when this script (and the ones before it) finished.
   */
  enqueue(script) {
    this.#tail = this.#tail
      .then(() => this.#run(script))
      .catch(error => this.#logError('agent script interrupted', error))
      .finally(() => {
        this.#running = false
      })
    return this.#tail
  }

  /** @param {() => Promise<void>} script */
  async #run(script) {
    this.#running = true
    this.#onStart()
    await script()
  }
}
