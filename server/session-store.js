import { createAgentSnapshot } from '#shared/agent-snapshot.js'
import { ANSWER_REASON, AgentStatus, EventType, MAIN_AGENT_ID } from '#shared/protocol.js'

/**
 * @typedef {import('#shared/protocol.js').OfficeEvent} OfficeEvent
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('#shared/protocol.js').SessionInfo} SessionInfo
 * @typedef {import('#shared/protocol.js').SessionSnapshot} SessionSnapshot
 * @typedef {import('#shared/protocol.js').ToolRecord} ToolRecord
 * @typedef {{ id: string, project: string, ended: boolean, agents: Map<string, AgentSnapshot> }} SessionState
 * @typedef {(session: SessionState, event: OfficeEvent, now: number) => AgentSnapshot | null} EventReducer
 */

const THOUGHTS_LIMIT = 12000
const HISTORY_LIMIT = 150

/**
 * Keeps every session's agents in memory and folds hook events into them.
 * @example
 * const store = new SessionStore({ now: Date.now })
 * store.apply({ type: 'turn.start', sessionId: 's1', project: 'app', timestamp: Date.now() })
 */
export class SessionStore {
  /** @type {Map<string, SessionState>} */
  #sessions = new Map()
  /** @type {string | null} */
  #latestId = null
  #now

  /** @param {{ now: () => number }} dependencies */
  constructor({ now }) {
    this.#now = now
  }

  /**
   * Applies one event and returns the agent it touched (null for session-level events).
   * @param {OfficeEvent} event
   * @returns {AgentSnapshot | null}
   */
  apply(event) {
    const session = this.#sessionFor(event)
    return REDUCERS[event.type](session, event, this.#now())
  }

  /**
   * @param {string} sessionId
   * @returns {SessionInfo | null}
   */
  info(sessionId) {
    const session = this.#sessions.get(sessionId)
    return session ? { id: session.id, project: session.project, ended: session.ended } : null
  }

  /**
   * Describes a session's live agents; falls back to the most recent session when the id is unknown.
   * @param {string | null} sessionId
   * @returns {SessionSnapshot | null}
   */
  snapshot(sessionId) {
    const session = this.#sessions.get(sessionId ?? '') ?? this.#sessions.get(this.#latestId ?? '')
    if (!session) return null
    const agents = [...session.agents.values()].filter(agent => !isFinished(agent))
    return { id: session.id, project: session.project, ended: session.ended, agents }
  }

  /**
   * @param {OfficeEvent} event
   * @returns {SessionState}
   */
  #sessionFor(event) {
    let session = this.#sessions.get(event.sessionId)
    if (!session) {
      session = { id: event.sessionId, project: event.project, ended: false, agents: new Map() }
      session.agents.set(MAIN_AGENT_ID, createAgentSnapshot(MAIN_AGENT_ID, {}, this.#now()))
      this.#sessions.set(session.id, session)
    }
    if (event.project) session.project = event.project
    this.#latestId = session.id
    return session
  }
}

/**
 * @param {AgentSnapshot} agent
 * @returns {boolean}
 */
function isFinished(agent) {
  return agent.status === AgentStatus.DONE || agent.status === AgentStatus.FAILED
}

/**
 * @param {SessionState} session
 * @param {OfficeEvent} event
 * @param {number} now
 * @returns {AgentSnapshot}
 */
function agentFor(session, event, now) {
  const id = event.agentId ?? MAIN_AGENT_ID
  let agent = session.agents.get(id)
  if (!agent) {
    agent = createAgentSnapshot(id, { parentId: MAIN_AGENT_ID }, now)
    session.agents.set(id, agent)
  }
  return agent
}

/** @type {EventReducer} */
function startSession(session) {
  session.ended = false
  return null
}

/** @type {EventReducer} */
function endSession(session) {
  session.ended = true
  return null
}

/**
 * A re-announced agent keeps what was already known about it (history, thoughts, prompt).
 * @type {EventReducer}
 */
function spawnAgent(session, event, now) {
  const id = event.agentId ?? MAIN_AGENT_ID
  const existing = session.agents.get(id)
  const agent = createAgentSnapshot(id, { ...existing, ...definedFields(event) }, now)
  if (existing) {
    agent.history = existing.history
    agent.thoughts = existing.thoughts
    agent.createdAt = existing.createdAt
    agent.prompt = event.prompt || existing.prompt
  }
  session.agents.set(id, agent)
  return agent
}

/**
 * @param {OfficeEvent} event
 * @returns {Partial<AgentSnapshot>}
 */
function definedFields(event) {
  /** @type {Partial<AgentSnapshot>} */
  const fields = {}
  if (event.parentId !== undefined) fields.parentId = event.parentId
  if (event.agentType !== undefined) fields.agentType = event.agentType
  if (event.description !== undefined) fields.description = event.description
  if (event.name !== undefined) fields.name = event.name
  if (event.prompt !== undefined) fields.prompt = event.prompt
  if (event.background !== undefined) fields.background = event.background
  return fields
}

/** @type {EventReducer} */
function finishAgent(session, event, now) {
  const agent = agentFor(session, event, now)
  agent.status = event.reason === ANSWER_REASON ? AgentStatus.DONE : AgentStatus.FAILED
  agent.answer = event.answer ?? ''
  agent.activeTools = {}
  agent.thinking = false
  return agent
}

/** @type {EventReducer} */
function startTurn(session, event, now) {
  const agent = agentFor(session, event, now)
  agent.status = AgentStatus.WORKING
  return agent
}

/** @type {EventReducer} */
function endTurn(session, event, now) {
  const agent = agentFor(session, event, now)
  agent.status = AgentStatus.WAITING
  agent.activeTools = {}
  agent.thinking = false
  return agent
}

/** @type {EventReducer} */
function startTool(session, event, now) {
  const agent = agentFor(session, event, now)
  const id = event.toolUseId ?? `${agent.id}-${event.timestamp}`
  /** @type {ToolRecord} */
  const record = {
    id,
    tool: event.tool ?? '',
    summary: event.summary ?? '',
    startedAt: event.timestamp,
    endedAt: null,
    failed: false,
  }
  agent.status = AgentStatus.WORKING
  agent.activeTools[id] = record
  agent.history.push(record)
  if (agent.history.length > HISTORY_LIMIT) agent.history.splice(0, agent.history.length - HISTORY_LIMIT)
  return agent
}

/** @type {EventReducer} */
function endTool(session, event, now) {
  const agent = agentFor(session, event, now)
  const record = agent.activeTools[event.toolUseId ?? '']
  if (!record) return agent
  record.endedAt = event.timestamp
  record.failed = Boolean(event.failed)
  delete agent.activeTools[record.id]
  return agent
}

/** @type {EventReducer} */
function startThinking(session, event, now) {
  const agent = agentFor(session, event, now)
  agent.thinking = true
  if (agent.thoughts) agent.thoughts += '\n\n'
  return agent
}

/** @type {EventReducer} */
function appendThinking(session, event, now) {
  const agent = agentFor(session, event, now)
  agent.thoughts = (agent.thoughts + (event.text ?? '')).slice(-THOUGHTS_LIMIT)
  return agent
}

/** @type {EventReducer} */
function endThinking(session, event, now) {
  const agent = agentFor(session, event, now)
  agent.thinking = false
  return agent
}

/** @type {Record<import('#shared/protocol.js').EventTypeName, EventReducer>} */
const REDUCERS = {
  [EventType.SESSION_START]: startSession,
  [EventType.SESSION_END]: endSession,
  [EventType.AGENT_SPAWNED]: spawnAgent,
  [EventType.AGENT_FINISHED]: finishAgent,
  [EventType.TURN_START]: startTurn,
  [EventType.TURN_END]: endTurn,
  [EventType.TOOL_START]: startTool,
  [EventType.TOOL_END]: endTool,
  [EventType.THINKING_START]: startThinking,
  [EventType.THINKING_DELTA]: appendThinking,
  [EventType.THINKING_END]: endThinking,
}
