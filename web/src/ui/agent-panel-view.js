import { MAIN_AGENT_ID } from '#shared/protocol.js'
import { agentDisplayName, escapeHtml } from '../agents/agent-names.js'
import { toolBubbleText } from '../agents/tool-catalog.js'
import { formatShortDuration, formatTimeOfDay, formatToolDuration } from '../i18n/formatters.js'
import { panelHeaderHtml } from './panel-header.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('#shared/protocol.js').ToolRecord} ToolRecord
 * @typedef {import('../coffee/coffee-stats.js').CoffeeStat} CoffeeStat
 * @typedef {import('../i18n/translator.js').Translator} Translator
 *
 * @typedef {object} AgentPanelInput
 * @property {AgentSnapshot} snapshot
 * @property {CoffeeStat} coffee
 * @property {Translator} translator
 * @property {number} now Epoch milliseconds, for tools still running.
 */

const HISTORY_SHOWN = 40

/**
 * Total time spent inside tool calls, counting running ones up to now.
 * @param {ToolRecord[]} history
 * @param {number} now
 * @returns {number}
 * @example timeInTools([{ startedAt: 0, endedAt: 1500 }], 0) // 1500
 */
export function timeInTools(history, now) {
  return history.reduce((total, record) => total + ((record.endedAt ?? now) - record.startedAt), 0)
}

/**
 * The agent details panel: status, coffee habits, current tools, task, live thoughts, tool history, answer.
 * @param {AgentPanelInput} input
 * @returns {string}
 * @example element.innerHTML = renderAgentPanel({ snapshot, coffee, translator, now: Date.now() })
 */
export function renderAgentPanel(input) {
  const { snapshot, translator } = input
  return [
    panelHeaderHtml(agentDisplayName(snapshot, translator), translator, snapshot.agentType),
    factsHtml(input),
    activeToolsHtml(snapshot, translator),
    taskHtml(snapshot, translator),
    thoughtsHtml(snapshot, translator),
    historyHtml(snapshot, translator),
    snapshot.answer
      ? sectionHtml(translator.t('panel.answer'), `<pre>${escapeHtml(snapshot.answer)}</pre>`)
      : '',
  ].join('')
}

/**
 * @param {string} title
 * @param {string} body
 * @returns {string}
 */
function sectionHtml(title, body) {
  return `<section><h3>${title}</h3>${body}</section>`
}

/**
 * @param {AgentSnapshot} snapshot
 * @param {Translator} translator
 * @returns {string}
 */
function statusText(snapshot, translator) {
  return translator.t(snapshot.thinking ? 'status.thinking' : `status.${snapshot.status}`)
}

/**
 * @param {AgentPanelInput} input
 * @returns {string}
 */
function factsHtml({ snapshot, coffee, translator, now }) {
  const t = translator.t.bind(translator)
  const fact = (/** @type {string} */ label, /** @type {string} */ value) =>
    `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`
  const parent = snapshot.parentId === MAIN_AGENT_ID ? t('agent.main') : snapshot.parentId
  const coffeeSummary = t('panel.coffeeSummary', {
    cups: t('coffee.cups', { count: coffee.cups }),
    coffeeTime: formatShortDuration(coffee.msAtCoffee),
    toolTime: formatShortDuration(timeInTools(snapshot.history, now)),
  })
  return `<dl class="panel-facts">${[
    fact(t('panel.status'), statusText(snapshot, translator)),
    parent ? fact(t('panel.createdBy'), parent) : '',
    snapshot.background ? fact(t('panel.execution'), t('panel.background')) : '',
    fact(t('panel.since'), formatTimeOfDay(snapshot.createdAt, translator.locale)),
    fact(t('panel.coffee'), coffeeSummary),
  ].join('')}</dl>`
}

/**
 * @param {AgentSnapshot} snapshot
 * @param {Translator} translator
 * @returns {string}
 */
function activeToolsHtml(snapshot, translator) {
  const active = Object.values(snapshot.activeTools)
  if (active.length === 0) return ''
  const items = active
    .map(record => `<li class="active">${escapeHtml(toolBubbleText(record, translator))}</li>`)
    .join('')
  return sectionHtml(translator.t('panel.now'), `<ul class="tool-list">${items}</ul>`)
}

/**
 * @param {AgentSnapshot} snapshot
 * @param {Translator} translator
 * @returns {string}
 */
function taskHtml(snapshot, translator) {
  if (!snapshot.prompt) return ''
  const summary = escapeHtml(snapshot.description || translator.t('panel.viewPrompt'))
  return sectionHtml(
    translator.t('panel.task'),
    `<details><summary>${summary}</summary><pre>${escapeHtml(snapshot.prompt)}</pre></details>`,
  )
}

/**
 * @param {AgentSnapshot} snapshot
 * @param {Translator} translator
 * @returns {string}
 */
function thoughtsHtml(snapshot, translator) {
  const live = snapshot.thinking
    ? ` <span class="live-badge">${escapeHtml(translator.t('panel.live'))}</span>`
    : ''
  const text = escapeHtml(snapshot.thoughts || translator.t('panel.noThoughts'))
  return sectionHtml(
    `${escapeHtml(translator.t('panel.thoughts'))}${live}`,
    `<pre class="thoughts">${text}</pre>`,
  )
}

/**
 * @param {AgentSnapshot} snapshot
 * @param {Translator} translator
 * @returns {string}
 */
function historyHtml(snapshot, translator) {
  const recent = snapshot.history.slice(-HISTORY_SHOWN).reverse()
  const items = recent.map(record => toolRowHtml(record, translator)).join('')
  const empty = `<li class="empty">${escapeHtml(translator.t('panel.noTools'))}</li>`
  const title = escapeHtml(translator.t('panel.tools', { count: snapshot.history.length }))
  return sectionHtml(title, `<ul class="tool-list">${items || empty}</ul>`)
}

/**
 * @param {ToolRecord} record
 * @param {Translator} translator
 * @returns {string}
 */
function toolRowHtml(record, translator) {
  const duration =
    record.endedAt === null
      ? translator.t('panel.inProgress')
      : formatToolDuration(record.endedAt - record.startedAt, translator.locale)
  return `<li class="${record.failed ? 'failed' : ''}"><span>${escapeHtml(toolBubbleText(record, translator))}</span><small>${escapeHtml(duration)}</small></li>`
}
