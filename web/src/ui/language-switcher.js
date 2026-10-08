import { SUPPORTED_LOCALES } from '../i18n/translator.js'
import { FLAG_SVG, LOCALE_NATIVE_NAMES } from './flags.js'

/**
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../i18n/locale-preference.js').LocalePreference} LocalePreference
 */

/**
 * Markup for the flag buttons; the active locale is marked pressed.
 * @param {string} activeLocale
 * @returns {string}
 * @example languageButtonsHtml('en') // two <button>s, the US flag pressed
 */
export function languageButtonsHtml(activeLocale) {
  return SUPPORTED_LOCALES.map(locale => {
    const pressed = locale === activeLocale
    const name = LOCALE_NATIVE_NAMES[locale]
    return `<button type="button" class="flag-button" data-locale="${locale}" aria-pressed="${pressed}" title="${name}" aria-label="${name}">${FLAG_SVG[locale]}</button>`
  }).join('')
}

/**
 * Brazilian and US flags in the header that switch the page language and remember the choice.
 * @example new LanguageSwitcher({ container: document.getElementById('language'), translator, preference })
 */
export class LanguageSwitcher {
  #container
  #translator

  /** @param {{ container: HTMLElement, translator: Translator, preference: LocalePreference }} dependencies */
  constructor({ container, translator, preference }) {
    this.#container = container
    this.#translator = translator
    container.addEventListener('click', event => {
      const button = /** @type {HTMLElement | null} */ (
        /** @type {Element} */ (event.target).closest('[data-locale]')
      )
      const locale = button?.dataset.locale
      if (!locale) return
      translator.setLocale(locale)
      preference.save(locale)
    })
    translator.onChange(() => this.render())
    this.render()
  }

  render() {
    this.#container.innerHTML = languageButtonsHtml(this.#translator.locale)
    this.#container.setAttribute('aria-label', this.#translator.t('header.language'))
  }
}
