import { escapeHtml } from '../agents/agent-names.js'

/** @typedef {import('../i18n/translator.js').Translator} Translator */

/**
 * The side panel's title bar: a small kicker line, the title and a close button.
 * @param {string} title
 * @param {Translator} translator
 * @param {string} [kicker]
 * @returns {string}
 * @example panelHeaderHtml('Main agent', translator, 'main')
 */
export function panelHeaderHtml(title, translator, kicker = '') {
  return `<header>
    <div><div class="panel-kicker">${escapeHtml(kicker)}</div><h2>${escapeHtml(title)}</h2></div>
    <button class="button" data-action="close" aria-label="${escapeHtml(translator.t('panel.close'))}">✕</button>
  </header>`
}
