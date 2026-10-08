// Posts fake hook events to a running office server, so the office can be watched without a real session.
import { ANSWER_REASON, DEFAULT_PORT, EventType, MAIN_AGENT_ID, Route } from '#shared/protocol.js'

/** @typedef {import('#shared/protocol.js').OfficeEvent} OfficeEvent */
/** @typedef {Partial<OfficeEvent> & { type: OfficeEvent['type'] }} SimulatedEvent */

/**
 * @param {number} seconds
 * @returns {Promise<void>}
 */
export const sleep = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000))

/**
 * A scripted fake session.
 * @example
 * const session = new SimulatedSession({ sessionId: 'demo', project: 'shop' })
 * await session.send({ type: 'turn.start', agentId: 'main' })
 */
export class SimulatedSession {
  #toolCounter = 0

  /** @param {{ sessionId: string, project: string, baseUrl?: string, log?: (line: string) => void }} options */
  constructor({
    sessionId,
    project,
    baseUrl = `http://127.0.0.1:${DEFAULT_PORT}`,
    log = line => console.log(line),
  }) {
    this.sessionId = sessionId
    this.project = project
    this.baseUrl = baseUrl
    this.log = log
  }

  get pageUrl() {
    return `${this.baseUrl}/?session=${encodeURIComponent(this.sessionId)}`
  }

  /** @param {...SimulatedEvent} events */
  async send(...events) {
    const batch = events.map(event => ({
      sessionId: this.sessionId,
      project: this.project,
      timestamp: Date.now(),
      ...event,
    }))
    const response = await fetch(`${this.baseUrl}${Route.EVENTS}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
    })
    if (!response.ok)
      throw new Error(`Server answered ${response.status}: ${await response.text()}; expected 204`)
    for (const event of batch)
      this.log(`${new Date().toLocaleTimeString()} ${event.type} ${event.agentId ?? ''} ${event.tool ?? ''}`)
  }

  /**
   * Runs one tool call that lasts `seconds`.
   * @param {string} agentId
   * @param {string} tool
   * @param {string} summary
   * @param {number} seconds
   * @param {boolean} [failed]
   */
  async useTool(agentId, tool, summary, seconds, failed = false) {
    const toolUseId = `${agentId}-${++this.#toolCounter}`
    await this.send({ type: EventType.TOOL_START, agentId, toolUseId, tool, summary })
    await sleep(seconds)
    await this.send({ type: EventType.TOOL_END, agentId, toolUseId, failed })
  }

  /**
   * The main agent hands a task to a new background subagent.
   * @param {string} agentId
   * @param {string} description
   * @param {string} [agentType]
   */
  async delegate(agentId, description, agentType = 'general-purpose') {
    await this.useTool(MAIN_AGENT_ID, 'Agent', description, 1)
    await this.send({
      type: EventType.AGENT_SPAWNED,
      agentId,
      parentId: MAIN_AGENT_ID,
      agentType,
      description,
      background: true,
    })
  }

  /**
   * @param {string} agentId
   * @param {string} answer
   * @param {boolean} [succeeded]
   */
  finish(agentId, answer, succeeded = true) {
    return this.send({
      type: EventType.AGENT_FINISHED,
      agentId,
      reason: succeeded ? ANSWER_REASON : 'error',
      answer,
    })
  }
}
