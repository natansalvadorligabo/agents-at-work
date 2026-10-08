/** @typedef {import('../i18n/translator.js').Translator} Translator */

/**
 * Translates the page's fixed markup: `data-i18n` sets the text, `data-i18n-title` the tooltip and
 * `data-i18n-aria-label` the accessible name. Also updates the document title and `lang`.
 * @param {Document} document
 * @param {Translator} translator
 * @example applyStaticTranslations(document, translator)
 */
export function applyStaticTranslations(document, translator) {
  document.documentElement.lang = translator.locale
  document.title = translator.t('page.title')
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = translator.t(element.getAttribute('data-i18n') ?? '')
  }
  translateAttribute(document, translator, 'title')
  translateAttribute(document, translator, 'aria-label')
}

/**
 * @param {Document} document
 * @param {Translator} translator
 * @param {'title' | 'aria-label'} attribute
 */
function translateAttribute(document, translator, attribute) {
  for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
    element.setAttribute(attribute, translator.t(element.getAttribute(`data-i18n-${attribute}`) ?? ''))
  }
}
