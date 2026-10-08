import { escapeHtml } from '../agents/agent-names.js'
import { toolBubbleText } from '../agents/tool-catalog.js'

/**
 * @typedef {import('#shared/protocol.js').PermissionRequest} PermissionRequest
 * @typedef {import('../i18n/translator.js').Translator} Translator
 */

/**
 * The permission card at the top of an agent's panel: what it wants to run, why the engine asks, and
 * Allow / Deny buttons — disabled when the page was not opened through /office and so holds no key.
 * @param {PermissionRequest} request
 * @param {{ canDecide: boolean, translator: Translator }} options
 * @returns {string}
 * @example renderPermissionRequest(snapshot.pendingPermission, { canDecide: true, translator })
 */
export function renderPermissionRequest(request, { canDecide, translator }) {
  const t = translator.t.bind(translator)
  const what = escapeHtml(toolBubbleText({ tool: request.tool, summary: request.summary }, translator))
  const reason = request.reason ? `<p class="panel-note">${escapeHtml(request.reason)}</p>` : ''
  const disabled = canDecide ? '' : ' disabled'
  const hint = canDecide ? t('permission.hint') : t('permission.noKey')
  return `<section class="permission-card" data-request-id="${escapeHtml(request.id)}">
    <h3>${escapeHtml(t('permission.title'))}</h3>
    <p class="permission-what">${what}</p>${reason}
    <div class="permission-actions">
      <button class="button button-allow" data-action="allow" data-request-id="${escapeHtml(request.id)}"${disabled}>${escapeHtml(t('permission.allow'))}</button>
      <button class="button button-deny" data-action="deny" data-request-id="${escapeHtml(request.id)}"${disabled}>${escapeHtml(t('permission.deny'))}</button>
    </div>
    <p class="panel-note">${escapeHtml(hint)}</p>
  </section>`
}
