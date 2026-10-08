import { AgentStatus, EventType, MAIN_AGENT_ID } from '#shared/protocol.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('#shared/protocol.js').SessionInfo} SessionInfo
 * @typedef {import('#shared/protocol.js').SessionSnapshot} SessionSnapshot
 * @typedef {import('#shared/protocol.js').StreamUpdate} StreamUpdate
 * @typedef {import('../agents/character.js').Character} Character
 *
 * The slice of the Office the sync drives; tests pass a fake.
 * @typedef {object} OfficeStage
 * @property {() => void} clearAll
 * @property {() => unknown} addMainAgent
 * @property {(snapshot: AgentSnapshot, options?: { restored?: boolean }) => unknown} addAgent
 * @property {(snapshot: AgentSnapshot) => Character | undefined} updateAgent
 * @property {(snapshot: AgentSnapshot) => void} finishAgent
 * @property {(agentId: string) => boolean} hasAgent
 * @property {(ended: boolean) => void} setSessionEnded
 *
 * @typedef {object} SessionSyncDependencies
 * @property {OfficeStage} office
 * @property {(session: SessionInfo) => void} showSession
 * @property {(agentId: string) => void} onAgentChanged
 * @property {(agentId: string) => void} onPermissionRequested An agent raised its hand.
 * @property {string | null} sessionId The session asked for in the URL; null follows the first one seen.
 */

/**
 * Keeps the office in step with the server's stream: rebuilds it from snapshots and applies live updates
 * for the session on display, remembering the latest snapshot of every agent for the details panel.
 * @example
 * const sync = new SessionSync({ office, showSession, onAgentChanged, sessionId: null })
 * sync.applyUpdate(update)
 */
export class SessionSync {
  /** @type {Map<string, AgentSnapshot>} */
  #snapshots = new Map()
  #deps
  #sessionId

  /** @param {SessionSyncDependencies} dependencies */
  constructor(dependencies) {
    this.#deps = dependencies
    this.#sessionId = dependencies.sessionId
  }

  get sessionId() {
    return this.#sessionId
  }

  /**
   * @param {string} agentId
   * @returns {AgentSnapshot | undefined}
   */
  snapshotOf(agentId) {
    return this.#snapshots.get(agentId)
  }

  /** @param {SessionSnapshot | null} session */
  applySnapshot(session) {
    const { office } = this.#deps
    office.clearAll()
    office.addMainAgent()
    this.#snapshots.clear()
    if (!session) return
    this.#sessionId ??= session.id
    this.#showSession(session)
    for (const agent of session.agents) this.#restore(agent)
  }

  /** @param {StreamUpdate} update */
  applyUpdate({ event, agent, session }) {
    this.#sessionId ??= event.sessionId
    if (event.sessionId !== this.#sessionId) return
    this.#showSession(session)
    if (!agent) return
    this.#remember(agent)
    if (event.type === EventType.AGENT_SPAWNED) return this.#spawn(agent, Boolean(event.restored))
    if (event.type === EventType.AGENT_FINISHED) return this.#deps.office.finishAgent(agent)
    if (event.type === EventType.PERMISSION_REQUESTED) this.#deps.onPermissionRequested(agent.id)
    this.#update(agent)
  }

  /** @param {AgentSnapshot} agent */
  #restore(agent) {
    this.#remember(agent)
    if (agent.id === MAIN_AGENT_ID) this.#deps.office.updateAgent(agent)
    else this.#deps.office.addAgent(agent, { restored: true })
  }

  /**
   * @param {AgentSnapshot} agent
   * @param {boolean} restored
   */
  #spawn(agent, restored) {
    if (this.#deps.office.hasAgent(agent.id)) this.#deps.office.updateAgent(agent)
    else this.#deps.office.addAgent(agent, { restored })
  }

  // Events can reach a subagent the page never saw spawn (opened mid-session): bring it in then.
  /** @param {AgentSnapshot} agent */
  #update(agent) {
    const character = this.#deps.office.updateAgent(agent)
    if (character || agent.id === MAIN_AGENT_ID || agent.status !== AgentStatus.WORKING) return
    this.#deps.office.addAgent(agent)
  }

  /** @param {AgentSnapshot} agent */
  #remember(agent) {
    this.#snapshots.set(agent.id, agent)
    this.#deps.onAgentChanged(agent.id)
  }

  /** @param {SessionInfo} session */
  #showSession(session) {
    this.#deps.showSession(session)
    this.#deps.office.setSessionEnded(session.ended)
  }
}
