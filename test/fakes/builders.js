import { createAgentSnapshot } from '../../shared/agent-snapshot.js'
import { en } from '../../web/src/i18n/locales/en.js'
import { ptBr } from '../../web/src/i18n/locales/pt-br.js'
import { Translator } from '../../web/src/i18n/translator.js'

/** @typedef {import('../../shared/protocol.js').AgentSnapshot} AgentSnapshot */
/** @typedef {import('../../shared/protocol.js').ToolRecord} ToolRecord */
/** @typedef {import('../../shared/protocol.js').OfficeEvent} OfficeEvent */

/**
 * @param {Partial<AgentSnapshot> & { id?: string }} [fields]
 * @returns {AgentSnapshot}
 */
export function agentSnapshot(fields = {}) {
  const id = fields.id ?? 'sub-1'
  return { ...createAgentSnapshot(id, { parentId: 'main' }, 0), ...fields }
}

/**
 * @param {Partial<ToolRecord>} [fields]
 * @returns {ToolRecord}
 */
export function toolRecord(fields = {}) {
  return { id: 't1', tool: 'Read', summary: 'app.ts', startedAt: 0, endedAt: null, failed: false, ...fields }
}

/**
 * @param {Partial<OfficeEvent> & { type: OfficeEvent['type'] }} fields
 * @returns {OfficeEvent}
 */
export function officeEvent(fields) {
  return { sessionId: 's1', project: 'shop', timestamp: 1000, ...fields }
}

/** @param {'en' | 'pt-BR'} [locale] */
export function translatorFor(locale = 'en') {
  return new Translator({ en, 'pt-BR': ptBr }, locale)
}
