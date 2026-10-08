// Wire protocol shared by the hooks module, the local server and the browser.
// Plain JS + JSDoc so all three runtimes (engine sandbox, Node, browser) load it without a build step.

/** Port the hooks module and the server agree on. */
export const DEFAULT_PORT = 47821

/** Id the hooks module uses for the session's own (non-subagent) agent. */
export const MAIN_AGENT_ID = 'main'

/** Agent type reported for the main agent; subagents carry their `subagent_type`. */
export const MAIN_AGENT_TYPE = 'main'

export const EventType = Object.freeze({
  SESSION_START: 'session.start',
  SESSION_END: 'session.end',
  TURN_START: 'turn.start',
  TURN_END: 'turn.end',
  AGENT_SPAWNED: 'agent.spawned',
  AGENT_FINISHED: 'agent.finished',
  TOOL_START: 'tool.start',
  TOOL_END: 'tool.end',
  THINKING_START: 'thinking.start',
  THINKING_DELTA: 'thinking.delta',
  THINKING_END: 'thinking.end',
})

export const AgentStatus = Object.freeze({
  WORKING: 'working',
  WAITING: 'waiting',
  DONE: 'done',
  FAILED: 'failed',
})

/** The reason `turn.complete` reports when an agent answered normally. */
export const ANSWER_REASON = 'answer'

/** HTTP routes served by the local server. */
export const Route = Object.freeze({
  EVENTS: '/events',
  STREAM: '/stream',
  HEALTH: '/health',
})

/** Server-sent event names on the `/stream` route. */
export const StreamMessage = Object.freeze({
  SNAPSHOT: 'snapshot',
  UPDATE: 'update',
})

/**
 * @typedef {(typeof EventType)[keyof typeof EventType]} EventTypeName
 * @typedef {(typeof AgentStatus)[keyof typeof AgentStatus]} AgentStatusName
 */

/**
 * One event as posted by the hooks module. Fields beyond `type` depend on the type.
 * @typedef {object} OfficeEvent
 * @property {EventTypeName} type
 * @property {string} sessionId
 * @property {string} project
 * @property {number} timestamp Epoch milliseconds.
 * @property {string} [agentId]
 * @property {string | null} [parentId]
 * @property {string} [agentType]
 * @property {string} [description]
 * @property {string | null} [name]
 * @property {string} [prompt]
 * @property {boolean} [background]
 * @property {boolean} [restored] True when re-announcing an agent that was already running.
 * @property {string} [reason]
 * @property {string} [answer]
 * @property {number} [durationMs]
 * @property {string} [toolUseId]
 * @property {string} [tool]
 * @property {string} [summary]
 * @property {boolean} [failed]
 * @property {string} [text]
 */

/**
 * @typedef {object} ToolRecord
 * @property {string} id
 * @property {string} tool
 * @property {string} summary
 * @property {number} startedAt Epoch milliseconds.
 * @property {number | null} endedAt
 * @property {boolean} failed
 */

/**
 * @typedef {object} AgentSnapshot
 * @property {string} id
 * @property {string | null} parentId
 * @property {string} agentType
 * @property {string} description
 * @property {string | null} name
 * @property {string} prompt
 * @property {boolean} background
 * @property {AgentStatusName} status
 * @property {Record<string, ToolRecord>} activeTools
 * @property {boolean} thinking
 * @property {string} thoughts
 * @property {ToolRecord[]} history
 * @property {string} answer
 * @property {number} createdAt
 */

/**
 * @typedef {object} SessionInfo
 * @property {string} id
 * @property {string} project
 * @property {boolean} ended
 */

/**
 * @typedef {SessionInfo & { agents: AgentSnapshot[] }} SessionSnapshot
 */

/**
 * @typedef {object} StreamUpdate
 * @property {OfficeEvent} event
 * @property {AgentSnapshot | null} agent
 * @property {SessionInfo} session
 */

/**
 * Tells whether an agent snapshot belongs to the session's main agent.
 * @param {{ id: string }} agent
 * @returns {boolean}
 * @example isMainAgent({ id: MAIN_AGENT_ID }) // true
 */
export function isMainAgent(agent) {
  return agent.id === MAIN_AGENT_ID
}
