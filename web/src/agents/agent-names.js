import { MAIN_AGENT_TYPE } from '#shared/protocol.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('../i18n/translator.js').Translator} Translator
 */

/**
 * The name shown for an agent: "Main agent" (translated), else its name, task description or type.
 * @param {Pick<AgentSnapshot, 'id' | 'agentType' | 'name' | 'description'>} agent
 * @param {Translator} translator
 * @returns {string}
 * @example agentDisplayName({ id: 'a1', agentType: 'Explore', name: null, description: 'Find the bug' }, t) // 'Find the bug'
 */
export function agentDisplayName(agent, translator) {
  if (agent.agentType === MAIN_AGENT_TYPE) return translator.t('agent.main')
  return agent.name || agent.description || agent.agentType || agent.id
}

/**
 * Escapes text for safe interpolation into HTML.
 * @param {unknown} text
 * @returns {string}
 * @example escapeHtml('<b>') // '&#60;b&#62;'
 */
export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`)
}

/**
 * Nameplate markup: a small type tag (subagents only) followed by the display name.
 * @param {Pick<AgentSnapshot, 'id' | 'agentType' | 'name' | 'description'>} agent
 * @param {Translator} translator
 * @returns {string}
 * @example nameplateHtml({ id: 'a', agentType: 'Plan', name: null, description: 'Plan it' }, t)
 */
export function nameplateHtml(agent, translator) {
  const name = escapeHtml(agentDisplayName(agent, translator))
  if (agent.agentType === MAIN_AGENT_TYPE) return name
  return `<span class="agent-type">${escapeHtml(agent.agentType)}</span>${name}`
}
