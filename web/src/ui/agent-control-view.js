import { AgentStatus, isMainAgent } from '#shared/protocol.js'
import { escapeHtml } from '../agents/agent-names.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('../i18n/translator.js').Translator} Translator
 *
 * What the panel says under the controls after a command: in flight, taken, or refused.
 * @typedef {{ text: string, failed: boolean }} ControlNote
 *
 * @typedef {object} AgentControlInput
 * @property {AgentSnapshot} snapshot
 * @property {Translator} translator
 * @property {boolean} canControl Whether this page holds the key to drive the session.
 * @property {(field: string) => string} draftOf What the viewer typed so far in a field of this agent.
 * @property {ControlNote | null} note
 * @property {boolean} busy A command is in flight: the buttons wait for it.
 * @property {boolean} spawnOpen Whether the new-subagent form is unfolded.
 */

/** The fields the panel keeps drafts of, by `data-draft` name. */
export const DraftField = Object.freeze({
  TEXT: 'text',
  SPAWN_DESCRIPTION: 'spawnDescription',
  SPAWN_TYPE: 'spawnType',
  SPAWN_PROMPT: 'spawnPrompt',
})

/**
 * Whether the agent is in the middle of a model turn, so a stop has something to stop.
 * @param {AgentSnapshot} snapshot
 * @returns {boolean}
 */
export function isRunning(snapshot) {
  return snapshot.status === AgentStatus.WORKING || snapshot.thinking
}

/**
 * The panel's controls, as the terminal offers them: a prompt for the main agent (plus hiring a
 * subagent), a message for a subagent (which resumes it once it finished), and Stop while it runs.
 * @param {AgentControlInput} input
 * @returns {string}
 * @example element.innerHTML += renderAgentControls({ snapshot, translator, canControl: true, draftOf, note: null, busy: false, spawnOpen: false })
 */
export function renderAgentControls(input) {
  const { snapshot, translator, canControl } = input
  const t = translator.t.bind(translator)
  if (!canControl) {
    return `<section class="agent-control"><p class="panel-note">${escapeHtml(t('control.noKey'))}</p></section>`
  }
  const main = isMainAgent(snapshot)
  const finished = snapshot.status === AgentStatus.DONE || snapshot.status === AgentStatus.FAILED
  const title = main ? t('control.promptTitle') : t(finished ? 'control.resumeTitle' : 'control.messageTitle')
  const placeholder = main ? t('control.promptPlaceholder') : t('control.messagePlaceholder')
  const disabled = input.busy ? ' disabled' : ''
  const stop = isRunning(snapshot)
    ? `<button class="button button-stop" data-action="stop"${disabled}>${escapeHtml(t('control.stop'))}</button>`
    : ''
  return `<section class="agent-control">
    <h3>${escapeHtml(title)}</h3>
    ${textareaHtml(DraftField.TEXT, input.draftOf(DraftField.TEXT), placeholder, 3)}
    <div class="control-actions">
      <button class="button button-send" data-action="send"${disabled}>${escapeHtml(t('control.send'))}</button>
      ${stop}
    </div>
    ${noteHtml(input, main && isRunning(snapshot) ? t('control.queuedHint') : t('control.hint'))}
    ${main ? spawnFormHtml(input) : ''}
  </section>`
}

/**
 * @param {AgentControlInput} input
 * @returns {string}
 */
function spawnFormHtml({ translator, draftOf, busy, spawnOpen }) {
  const t = translator.t.bind(translator)
  const disabled = busy ? ' disabled' : ''
  return `<details class="spawn-form"${spawnOpen ? ' open' : ''}>
    <summary>${escapeHtml(t('control.spawnTitle'))}</summary>
    <label>${escapeHtml(t('control.spawnDescription'))}
      <input data-draft="${DraftField.SPAWN_DESCRIPTION}" value="${escapeHtml(draftOf(DraftField.SPAWN_DESCRIPTION))}" placeholder="${escapeHtml(t('control.spawnDescriptionPlaceholder'))}">
    </label>
    <label>${escapeHtml(t('control.spawnType'))}
      <input data-draft="${DraftField.SPAWN_TYPE}" value="${escapeHtml(draftOf(DraftField.SPAWN_TYPE))}" placeholder="general-purpose" list="agent-types">
    </label>
    <datalist id="agent-types"><option value="general-purpose"><option value="Explore"><option value="Plan"></datalist>
    <label>${escapeHtml(t('control.spawnPrompt'))}
      ${textareaHtml(DraftField.SPAWN_PROMPT, draftOf(DraftField.SPAWN_PROMPT), t('control.spawnPromptPlaceholder'), 4)}
    </label>
    <div class="control-actions">
      <button class="button button-send" data-action="spawn"${disabled}>${escapeHtml(t('control.spawn'))}</button>
    </div>
  </details>`
}

/**
 * @param {string} field
 * @param {string} value
 * @param {string} placeholder
 * @param {number} rows
 * @returns {string}
 */
function textareaHtml(field, value, placeholder, rows) {
  return `<textarea data-draft="${field}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
}

/**
 * @param {AgentControlInput} input
 * @param {string} hint Shown when there is no note.
 * @returns {string}
 */
function noteHtml({ note }, hint) {
  const failed = note?.failed ? ' failed' : ''
  return `<p class="panel-note control-note${failed}">${escapeHtml(note?.text ?? hint)}</p>`
}
