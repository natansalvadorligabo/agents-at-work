import { renderAgentPanel } from './agent-panel-view.js'
import { renderCoffeeRanking } from './coffee-ranking-view.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('../coffee/coffee-stats.js').CoffeeStat} CoffeeStat
 * @typedef {import('../coffee/coffee-stats.js').CoffeeRankingRow} CoffeeRankingRow
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('#shared/interval-timer.js').IntervalTimer} IntervalTimer
 *
 * @typedef {object} CoffeeLedger
 * @property {(agentId: string) => CoffeeStat} statFor
 * @property {() => CoffeeRankingRow[]} ranking
 *
 * @typedef {object} DetailsPanelDependencies
 * @property {HTMLElement} element
 * @property {(agentId: string) => AgentSnapshot | undefined} snapshotOf
 * @property {CoffeeLedger} coffee
 * @property {Translator} translator
 * @property {Clock} clock
 * @property {IntervalTimer} timer
 * @property {(callback: () => void) => void} nextFrame
 *
 * @typedef {{ kind: 'closed' } | { kind: 'agent', agentId: string } | { kind: 'ranking' }} PanelView
 */

const RANKING_REFRESH_MS = 1000
const STICK_TO_BOTTOM_PX = 24

/**
 * The side panel: an agent's details, or the coffee ranking (refreshed every second while open).
 * @example
 * const panel = new DetailsPanel({ element, snapshotOf, coffee, translator, clock, timer, nextFrame })
 * panel.openAgent('main')
 */
export class DetailsPanel {
  /** @type {PanelView} */
  view = { kind: 'closed' }
  /** @type {(() => void) | null} */
  #stopRankingRefresh = null
  #redrawScheduled = false
  #deps

  /** @param {DetailsPanelDependencies} dependencies */
  constructor(dependencies) {
    this.#deps = dependencies
    dependencies.element.addEventListener('click', event => {
      if (/** @type {Element} */ (event.target).closest('[data-action="close"]')) this.close()
    })
    dependencies.translator.onChange(() => this.redraw())
  }

  /** @param {string} agentId */
  openAgent(agentId) {
    this.#stopRanking()
    this.#show({ kind: 'agent', agentId })
  }

  openRanking() {
    this.#stopRanking()
    this.#show({ kind: 'ranking' })
    this.#stopRankingRefresh = this.#deps.timer.every(RANKING_REFRESH_MS, () => this.redraw())
  }

  close() {
    this.#stopRanking()
    this.view = { kind: 'closed' }
    this.#deps.element.classList.remove('open')
  }

  /**
   * Redraws on the next frame if the changed agent is the one on display; bursts of updates coalesce.
   * @param {string} agentId
   */
  notifyAgentChanged(agentId) {
    if (this.view.kind !== 'agent' || this.view.agentId !== agentId || this.#redrawScheduled) return
    this.#redrawScheduled = true
    this.#deps.nextFrame(() => {
      this.#redrawScheduled = false
      this.redraw()
    })
  }

  redraw() {
    if (this.view.kind === 'ranking') this.#drawRanking()
    if (this.view.kind === 'agent') this.#drawAgent(this.view.agentId)
  }

  /** @param {PanelView} view */
  #show(view) {
    this.view = view
    this.#deps.element.classList.add('open')
    this.redraw()
  }

  #stopRanking() {
    this.#stopRankingRefresh?.()
    this.#stopRankingRefresh = null
  }

  #drawRanking() {
    this.#deps.element.innerHTML = renderCoffeeRanking(this.#deps.coffee.ranking(), this.#deps.translator)
  }

  /** @param {string} agentId */
  #drawAgent(agentId) {
    const { element, snapshotOf, coffee, translator, clock } = this.#deps
    const snapshot = snapshotOf(agentId)
    if (!snapshot) return
    const previous = element.querySelector('.thoughts')
    const followTail =
      !previous || previous.scrollHeight - previous.scrollTop - previous.clientHeight < STICK_TO_BOTTOM_PX
    const previousScroll = previous?.scrollTop ?? 0
    element.innerHTML = renderAgentPanel({
      snapshot,
      coffee: coffee.statFor(agentId),
      translator,
      now: clock.now(),
    })
    // Keep live thoughts scrolled to the end unless the viewer scrolled up to read.
    const thoughts = element.querySelector('.thoughts')
    if (thoughts) thoughts.scrollTop = followTail ? thoughts.scrollHeight : previousScroll
  }
}
