import { CommandKind, isMainAgent } from '#shared/protocol.js'
import { DraftField } from './agent-control-view.js'
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
 * @property {SessionControl} control
 *
 * What the page can do to the session, holding its control key (`canDecide`).
 * @typedef {object} SessionControl
 * @property {boolean} canDecide
 * @property {(requestId: string, decision: 'allow' | 'deny') => Promise<void>} decidePermission
 * @property {(command: import('../app/control-client.js').CommandRequest) => Promise<void>} sendCommand
 *
 * @typedef {import('./agent-control-view.js').ControlNote} ControlNote
 * @typedef {'send' | 'stop' | 'spawn'} ControlAction
 *
 * @typedef {{ kind: 'closed' } | { kind: 'agent', agentId: string } | { kind: 'ranking' }} PanelView
 */

const RANKING_REFRESH_MS = 1000
const STICK_TO_BOTTOM_PX = 24
/** @type {string[]} */
const SPAWN_FIELDS = [DraftField.SPAWN_DESCRIPTION, DraftField.SPAWN_TYPE, DraftField.SPAWN_PROMPT]

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
  /** @type {Map<string, string>} What the viewer typed, by `<agentId>:<field>`; survives live redraws. */
  #drafts = new Map()
  /** @type {Map<string, ControlNote>} */
  #notes = new Map()
  /** @type {Set<string>} Agents with a command in flight. */
  #busy = new Set()
  #spawnOpen = false

  /** @param {DetailsPanelDependencies} dependencies */
  constructor(dependencies) {
    this.#deps = dependencies
    const { element } = dependencies
    element.addEventListener('click', event => this.#onClick(/** @type {Element} */ (event.target)))
    element.addEventListener('input', event => this.#onInput(/** @type {Element} */ (event.target)))
    element.addEventListener('keydown', event => this.#onKeyDown(/** @type {KeyboardEvent} */ (event)))
    // `toggle` does not bubble; listen while it travels down instead.
    element.addEventListener('toggle', event => this.#onToggle(/** @type {Element} */ (event.target)), true)
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

  /** @param {Element} target */
  #onClick(target) {
    if (target.closest('[data-action="close"]')) return this.close()
    const button = /** @type {HTMLButtonElement | null} */ (
      target.closest('[data-action="allow"], [data-action="deny"]')
    )
    if (button) return void this.#answerPermission(button)
    const control = /** @type {HTMLElement | null} */ (
      target.closest('[data-action="send"], [data-action="stop"], [data-action="spawn"]')
    )
    if (control) void this.#runControl(/** @type {ControlAction} */ (control.dataset.action))
  }

  /** @param {Element} target */
  #onInput(target) {
    const field = /** @type {HTMLElement} */ (target).dataset?.draft
    if (!field || this.view.kind !== 'agent') return
    this.#drafts.set(`${this.view.agentId}:${field}`, /** @type {HTMLInputElement} */ (target).value)
  }

  /** @param {Element} target */
  #onToggle(target) {
    if (target.classList?.contains('spawn-form'))
      this.#spawnOpen = /** @type {HTMLDetailsElement} */ (target).open
  }

  /**
   * Ctrl+Enter (or Cmd+Enter) sends, as the button next to the field would.
   * @param {KeyboardEvent} event
   */
  #onKeyDown(event) {
    const field = /** @type {HTMLElement} */ (event.target).dataset?.draft
    if (!field || event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    void this.#runControl(SPAWN_FIELDS.includes(field) ? 'spawn' : 'send')
  }

  /**
   * Sends a prompt, a message, a stop or a hire for the agent on display, and says how it went.
   * @param {ControlAction} action
   */
  async #runControl(action) {
    if (this.view.kind !== 'agent') return
    const { agentId } = this.view
    const command = this.#commandFor(agentId, action)
    if (!command || this.#busy.has(agentId)) return
    const { translator } = this.#deps
    this.#busy.add(agentId)
    this.#notes.set(agentId, { text: translator.t('control.sending'), failed: false })
    this.redraw()
    try {
      await this.#deps.control.sendCommand(command)
      for (const field of action === 'spawn' ? SPAWN_FIELDS : action === 'send' ? [DraftField.TEXT] : [])
        this.#drafts.delete(`${agentId}:${field}`)
      this.#notes.set(agentId, { text: translator.t(`control.done.${command.kind}`), failed: false })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      this.#notes.set(agentId, { text: translator.t('control.failed', { error: reason }), failed: true })
    } finally {
      this.#busy.delete(agentId)
      this.redraw()
    }
  }

  /**
   * @param {string} agentId
   * @param {ControlAction} action
   * @returns {import('../app/control-client.js').CommandRequest | null} Null when there is nothing to send.
   */
  #commandFor(agentId, action) {
    const draft = (/** @type {string} */ field) => (this.#drafts.get(`${agentId}:${field}`) ?? '').trim()
    if (action === 'stop') return { kind: CommandKind.STOP, agentId }
    if (action === 'spawn') {
      const text = draft(DraftField.SPAWN_PROMPT)
      if (!text) return null
      const description = draft(DraftField.SPAWN_DESCRIPTION) || undefined
      const subagentType = draft(DraftField.SPAWN_TYPE) || undefined
      return { kind: CommandKind.SPAWN, agentId, text, description, subagentType }
    }
    const text = draft(DraftField.TEXT)
    if (!text) return null
    return { kind: isMainAgent({ id: agentId }) ? CommandKind.PROMPT : CommandKind.MESSAGE, agentId, text }
  }

  /**
   * Sends Allow / Deny; the card disappears when the server confirms through the stream.
   * @param {HTMLButtonElement} button
   */
  async #answerPermission(button) {
    const decision = button.dataset.action === 'allow' ? 'allow' : 'deny'
    const card = button.closest('.permission-card')
    for (const other of card?.querySelectorAll('button') ?? []) other.disabled = true
    try {
      await this.#deps.control.decidePermission(button.dataset.requestId ?? '', decision)
    } catch (error) {
      const note = card?.querySelector('.panel-note:last-child')
      if (note) note.textContent = this.#deps.translator.t('permission.failed', { error: String(error) })
    }
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
    const focus = focusedDraft(element)
    element.innerHTML = renderAgentPanel({
      snapshot,
      coffee: coffee.statFor(agentId),
      translator,
      now: clock.now(),
      canDecide: this.#deps.control.canDecide,
      controls: {
        canControl: this.#deps.control.canDecide,
        draftOf: field => this.#drafts.get(`${agentId}:${field}`) ?? '',
        note: this.#notes.get(agentId) ?? null,
        busy: this.#busy.has(agentId),
        spawnOpen: this.#spawnOpen,
      },
    })
    restoreFocus(element, focus)
    // Keep live thoughts scrolled to the end unless the viewer scrolled up to read.
    const thoughts = element.querySelector('.thoughts')
    if (thoughts) thoughts.scrollTop = followTail ? thoughts.scrollHeight : previousScroll
  }
}

/**
 * The draft field the viewer is typing in, and where the cursor is, so a redraw can put them back.
 * @param {HTMLElement} element
 * @returns {{ field: string, start: number | null, end: number | null } | null}
 */
function focusedDraft(element) {
  const active = /** @type {HTMLInputElement | null} */ (element.querySelector('[data-draft]:focus'))
  const field = active?.dataset.draft
  return active && field ? { field, start: active.selectionStart, end: active.selectionEnd } : null
}

/**
 * @param {HTMLElement} element
 * @param {{ field: string, start: number | null, end: number | null } | null} focus
 */
function restoreFocus(element, focus) {
  if (!focus) return
  const field = /** @type {HTMLInputElement | null} */ (
    element.querySelector(`[data-draft="${focus.field}"]`)
  )
  if (!field) return
  field.focus()
  if (focus.start !== null) field.setSelectionRange(focus.start, focus.end)
}
