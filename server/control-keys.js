import { keysMatch } from './request-guard.js'

const MIN_KEY_LENGTH = 32

/**
 * The secret per session that the office page must present to act on the session. The hooks module
 * creates it and registers it here; the page gets it from the link `/office` opens.
 * @example
 * keys.register('s1', crypto.randomUUID() + crypto.randomUUID())
 * keys.accepts('s1', presentedKey)
 */
export class ControlKeys {
  /** @type {Map<string, string>} */
  #keys = new Map()

  /**
   * Registers (or replaces, after a plugin reload) the key of a session.
   * @param {string} sessionId
   * @param {unknown} key
   */
  register(sessionId, key) {
    if (typeof key !== 'string' || key.length < MIN_KEY_LENGTH) {
      throw new RangeError(
        `Control key for session ${JSON.stringify(sessionId)} is too weak; expected a string of ${MIN_KEY_LENGTH}+ characters`,
      )
    }
    this.#keys.set(sessionId, key)
  }

  /**
   * @param {string} sessionId
   * @param {string | undefined} presented
   * @returns {boolean}
   */
  accepts(sessionId, presented) {
    return keysMatch(presented, this.#keys.get(sessionId))
  }
}
