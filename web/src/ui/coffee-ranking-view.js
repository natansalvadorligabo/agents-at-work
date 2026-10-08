import { agentDisplayName, escapeHtml } from '../agents/agent-names.js'
import { formatShortDuration } from '../i18n/formatters.js'
import { panelHeaderHtml } from './panel-header.js'

/**
 * @typedef {import('../coffee/coffee-stats.js').CoffeeRankingRow} CoffeeRankingRow
 * @typedef {import('../i18n/translator.js').Translator} Translator
 */

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * The coffee machine's "employee of the month (in reverse)": who spent the longest blocked.
 * @param {CoffeeRankingRow[]} rows Already sorted.
 * @param {Translator} translator
 * @returns {string}
 * @example element.innerHTML = renderCoffeeRanking(stats.ranking(), translator)
 */
export function renderCoffeeRanking(rows, translator) {
  const items = rows.map((row, index) => rankingRowHtml(row, index, translator)).join('')
  const empty = `<li class="empty">${escapeHtml(translator.t('ranking.empty'))}</li>`
  return `${panelHeaderHtml(translator.t('ranking.title'), translator, translator.t('ranking.kicker'))}
    <p class="panel-note">${escapeHtml(translator.t('ranking.note'))}</p>
    <ul class="tool-list coffee-ranking">${items || empty}</ul>`
}

/**
 * @param {CoffeeRankingRow} row
 * @param {number} index
 * @param {Translator} translator
 * @returns {string}
 */
function rankingRowHtml(row, index, translator) {
  const place = MEDALS[index] ?? `${index + 1}.`
  const now = row.atCoffee ? ` ${translator.t('ranking.now')}` : ''
  const cups = translator.t('coffee.cups', { count: row.cups })
  return `<li class="${row.atCoffee ? 'active' : ''}">
    <span>${place} ${escapeHtml(agentDisplayName(row.agent, translator))}${escapeHtml(now)}</span>
    <small>${escapeHtml(cups)} · ${escapeHtml(formatShortDuration(row.msAtCoffee))}</small>
  </li>`
}
