/**
 * @typedef {'en' | 'pt-BR'} LocaleCode
 * @typedef {readonly [string, string]} GossipTemplate An opening line and its reply; both may use {someone} and {otherCups}.
 * @typedef {{ messages: Record<string, string>, gossip: readonly GossipTemplate[] }} Catalog
 * @typedef {Record<string, string | number>} MessageParams
 */

export const SUPPORTED_LOCALES = /** @type {const} */ (['pt-BR', 'en'])

/**
 * Replaces `{name}` placeholders with the given params; unknown placeholders are left as they are.
 * @param {string} template
 * @param {MessageParams} params
 * @returns {string}
 * @example interpolate('{count} coffees', { count: 3 }) // '3 coffees'
 */
export function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
    name in params ? String(params[name]) : placeholder,
  )
}

/**
 * Chooses the locale to start with: the one the viewer picked before, else the browser's language.
 * @param {string | null} stored
 * @param {readonly string[]} browserLanguages
 * @returns {LocaleCode}
 * @example detectLocale(null, ['pt-BR', 'en']) // 'pt-BR'
 */
export function detectLocale(stored, browserLanguages) {
  if (stored === 'en' || stored === 'pt-BR') return stored
  return browserLanguages[0]?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

/**
 * Looks up UI text in the active locale and notifies listeners when the locale changes.
 * @example
 * const translator = new Translator({ en, 'pt-BR': ptBr }, 'en')
 * translator.t('coffee.cups', { count: 2 }) // '2 coffees'
 */
export class Translator {
  #catalogs
  #locale
  /** @type {Set<(locale: LocaleCode) => void>} */
  #listeners = new Set()

  /**
   * @param {Record<LocaleCode, Catalog>} catalogs
   * @param {LocaleCode} locale
   */
  constructor(catalogs, locale) {
    this.#catalogs = catalogs
    this.#locale = locale
  }

  /** @returns {LocaleCode} */
  get locale() {
    return this.#locale
  }

  /**
   * @param {string} locale
   */
  setLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(/** @type {LocaleCode} */ (locale))) {
      throw new RangeError(
        `Unknown locale ${JSON.stringify(locale)}; expected one of ${SUPPORTED_LOCALES.join(', ')}`,
      )
    }
    if (locale === this.#locale) return
    this.#locale = /** @type {LocaleCode} */ (locale)
    for (const listener of this.#listeners) listener(this.#locale)
  }

  /**
   * Subscribes to locale changes.
   * @param {(locale: LocaleCode) => void} listener
   * @returns {() => void} Unsubscribes.
   */
  onChange(listener) {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /**
   * Translates a key. With a numeric `count` param, `key.one` / `key.other` are tried first.
   * @param {string} key
   * @param {MessageParams} [params]
   * @returns {string}
   */
  t(key, params = {}) {
    const messages = this.#catalogs[this.#locale].messages
    const pluralKey = typeof params.count === 'number' ? `${key}.${this.#pluralCategory(params.count)}` : null
    const template = (pluralKey && messages[pluralKey]) ?? messages[key]
    if (template === undefined) {
      throw new RangeError(
        `Missing translation ${JSON.stringify(key)} for locale ${this.#locale}; expected a key of every catalog`,
      )
    }
    return interpolate(template, params)
  }

  /** @returns {readonly GossipTemplate[]} */
  gossipTemplates() {
    return this.#catalogs[this.#locale].gossip
  }

  /**
   * @param {number} count
   * @returns {'one' | 'other'}
   */
  #pluralCategory(count) {
    return new Intl.PluralRules(this.#locale).select(count) === 'one' ? 'one' : 'other'
  }
}
