import { AgentStatus, MAIN_AGENT_ID, MAIN_AGENT_TYPE } from './protocol.js'

/** @typedef {import('./protocol.js').AgentSnapshot} AgentSnapshot */

/**
 * Builds a fresh agent snapshot; the main agent starts waiting, subagents start working.
 * @param {string} id
 * @param {Partial<AgentSnapshot>} fields
 * @param {number} now
 * @returns {AgentSnapshot}
 * @example createAgentSnapshot('main', {}, Date.now()).status // 'waiting'
 */
export function createAgentSnapshot(id, fields, now) {
  const isMain = id === MAIN_AGENT_ID
  return {
    id,
    parentId: fields.parentId ?? null,
    agentType: fields.agentType ?? (isMain ? MAIN_AGENT_TYPE : 'general-purpose'),
    description: fields.description ?? '',
    name: fields.name ?? null,
    prompt: fields.prompt ?? '',
    background: fields.background ?? false,
    status: isMain ? AgentStatus.WAITING : AgentStatus.WORKING,
    activeTools: {},
    thinking: false,
    thoughts: '',
    history: [],
    answer: '',
    createdAt: now,
  }
}
