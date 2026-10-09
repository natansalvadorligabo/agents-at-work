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
  PERMISSION_REQUESTED: 'permission.requested',
  PERMISSION_RESOLVED: 'permission.resolved',
})

/** Event types the server raises itself; hooks may not post them to /events. */
export const SERVER_EVENT_TYPES = Object.freeze([
  EventType.PERMISSION_REQUESTED,
  EventType.PERMISSION_RESOLVED,
])

/**
 * What the office can answer to a permission request; `expired` means nobody answered on the web and the
 * terminal dialog takes over.
 */
export const PermissionDecision = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  PENDING: 'pending',
  EXPIRED: 'expired',
})

/**
 * What the office page can ask the session to do, as the terminal would: prompt the main agent, message a
 * subagent (resuming it when it already finished), stop an agent's running turn, or spawn a subagent.
 */
export const CommandKind = Object.freeze({
  PROMPT: 'prompt',
  MESSAGE: 'message',
  STOP: 'stop',
  SPAWN: 'spawn',
})

/** Header carrying the session's control key on requests that act on the session. */
export const CONTROL_KEY_HEADER = 'x-agents-at-work-key'

/** URL query parameter the /office link uses to hand the control key to the page. */
export const CONTROL_KEY_PARAM = 'key'

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
  CONTROL_REGISTER: '/control/register',
  PERMISSIONS: '/permissions',
  COMMANDS: '/commands',
})

/** Server-sent event names on the `/stream` route. */
export const StreamMessage = Object.freeze({
  SNAPSHOT: 'snapshot',
  UPDATE: 'update',
})

/**
 * @typedef {(typeof EventType)[keyof typeof EventType]} EventTypeName
 * @typedef {(typeof AgentStatus)[keyof typeof AgentStatus]} AgentStatusName
 * @typedef {(typeof PermissionDecision)[keyof typeof PermissionDecision]} PermissionDecisionName
 * @typedef {(typeof CommandKind)[keyof typeof CommandKind]} CommandKindName
 */

/**
 * A command from the office page, as the hooks module receives it. `text` is the prompt or message (the
 * spawned subagent's task for `spawn`); `description` and `subagentType` only travel with `spawn`.
 * @typedef {object} OfficeCommand
 * @property {string} id
 * @property {CommandKindName} kind
 * @property {string} agentId
 * @property {string} [text]
 * @property {string} [description]
 * @property {string} [subagentType]
 */

/**
 * How the session took a command: `ok`, or the reason it could not.
 * @typedef {{ ok: true } | { ok: false, error: string }} CommandOutcome
 */

/**
 * A tool call waiting for someone to allow or deny it.
 * @typedef {object} PermissionRequest
 * @property {string} id
 * @property {string} tool
 * @property {string} summary
 * @property {string} reason Why the engine asks, as its verdict said.
 * @property {number} requestedAt Epoch milliseconds.
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
 * @property {string} [requestId]
 * @property {PermissionDecisionName} [decision]
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
 * @property {PermissionRequest | null} pendingPermission
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
