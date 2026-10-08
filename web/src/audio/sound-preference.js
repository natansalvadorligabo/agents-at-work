/** @typedef {import('../i18n/locale-preference.js').KeyValueStorage} KeyValueStorage */

const STORAGE_KEY = 'agents-at-work.sound'

/**
 * Remembers whether the viewer muted the office. Like the language choice, storage failures degrade to the
 * default (sound on) instead of breaking the page.
 * @example
 * const preference = new SoundPreference(window.localStorage)
 * preference.save(true) // muted
 */
export class SoundPreference {
  #storage

  /** @param {KeyValueStorage | null} storage */
  constructor(storage) {
    this.#storage = storage
  }

  /** @returns {boolean} Whether the viewer muted the sound. */
  loadMuted() {
    try {
      return this.#storage?.getItem(STORAGE_KEY) === 'off'
    } catch {
      return false
    }
  }

  /** @param {boolean} muted */
  save(muted) {
    try {
      this.#storage?.setItem(STORAGE_KEY, muted ? 'off' : 'on')
    } catch {
      // Not remembering the choice is acceptable; the page keeps working.
    }
  }
}
