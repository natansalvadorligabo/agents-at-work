/**
 * The slice of `Storage` the preference needs.
 * @typedef {object} KeyValueStorage
 * @property {(key: string) => string | null} getItem
 * @property {(key: string, value: string) => void} setItem
 */

const STORAGE_KEY = 'agents-at-work.locale'

/**
 * Remembers the viewer's language choice. Storage can be missing or throw (private windows, blocked
 * site data), so every access degrades to "no preference" instead of breaking the page.
 * @example
 * const preference = new LocalePreference(window.localStorage)
 * preference.save('en')
 */
export class LocalePreference {
  #storage

  /** @param {KeyValueStorage | null} storage */
  constructor(storage) {
    this.#storage = storage
  }

  /** @returns {string | null} */
  load() {
    try {
      return this.#storage?.getItem(STORAGE_KEY) ?? null
    } catch {
      return null
    }
  }

  /** @param {string} locale */
  save(locale) {
    try {
      this.#storage?.setItem(STORAGE_KEY, locale)
    } catch {
      // Not remembering the choice is acceptable; the page keeps working.
    }
  }
}
