/** @typedef {import('../i18n/translator.js').LocaleCode} LocaleCode */

// Inline SVG instead of flag emoji: Windows renders 🇧🇷 / 🇺🇸 as plain letters.

const BRAZIL_FLAG = `<svg viewBox="0 0 20 14" aria-hidden="true">
  <rect width="20" height="14" fill="#009c3b"/>
  <path d="M10 1.6 18.2 7 10 12.4 1.8 7Z" fill="#ffdf00"/>
  <circle cx="10" cy="7" r="3.3" fill="#002776"/>
  <path d="M6.9 6.2c2.2-.5 4.4-.1 6.3 1" stroke="#fff" stroke-width=".6" fill="none"/>
</svg>`

/**
 * @returns {string}
 */
function usaStars() {
  return Array.from({ length: 20 }, (_, i) => {
    const row = Math.floor(i / 5)
    const column = i % 5
    const x = 0.76 + column * 1.52 + (row % 2) * 0.38
    return `<circle cx="${x.toFixed(2)}" cy="${(0.62 + row * 1.35).toFixed(2)}" r="0.28"/>`
  }).join('')
}

const USA_FLAG = `<svg viewBox="0 0 19 10" aria-hidden="true">
  <rect width="19" height="10" fill="#b22234"/>
  <path d="M0 1.15h19M0 2.69h19M0 4.23h19M0 5.77h19M0 7.31h19M0 8.85h19" stroke="#fff" stroke-width=".77"/>
  <rect width="7.6" height="5.38" fill="#3c3b6e"/>
  <g fill="#fff">${usaStars()}</g>
</svg>`

/** @type {Record<LocaleCode, string>} */
export const FLAG_SVG = { 'pt-BR': BRAZIL_FLAG, en: USA_FLAG }

/**
 * Each language is named in itself, so it can be found whatever the current language is.
 * @type {Record<LocaleCode, string>}
 */
export const LOCALE_NATIVE_NAMES = { 'pt-BR': 'Português (Brasil)', en: 'English (US)' }
