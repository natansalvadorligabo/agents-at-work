import { MAIN_AGENT_ID } from '#shared/protocol.js'

/**
 * @typedef {import('../agents/character.js').Character} Character
 * @typedef {import('../agents/agent-controller.js').AgentController} AgentController
 * @typedef {{ character: Character, controller: AgentController }} RosterEntry
 */

/**
 * Who is in the office right now: each agent's character (body) and controller (behavior).
 * @example
 * roster.add({ character, controller })
 * roster.childCountOf('main') // 1
 */
export class AgentRoster {
  /** @type {Map<string, RosterEntry>} */
  #entries = new Map()

  /** @param {RosterEntry} entry */
  add(entry) {
    this.#entries.set(entry.character.id, entry)
  }

  /** @param {string} agentId */
  has(agentId) {
    return this.#entries.has(agentId)
  }

  /**
   * @param {string} agentId
   * @returns {RosterEntry | undefined}
   */
  get(agentId) {
    return this.#entries.get(agentId)
  }

  /**
   * Disposes the agent's character and forgets it.
   * @param {string} agentId
   * @returns {boolean} Whether the agent was there.
   */
  remove(agentId) {
    const entry = this.#entries.get(agentId)
    entry?.character.dispose()
    return this.#entries.delete(agentId)
  }

  /** @returns {string[]} */
  ids() {
    return [...this.#entries.keys()]
  }

  /** @returns {Character[]} */
  characters() {
    return [...this.#entries.values()].map(entry => entry.character)
  }

  /** @returns {AgentController[]} */
  controllers() {
    return [...this.#entries.values()].map(entry => entry.controller)
  }

  /**
   * Counts subagents of a parent that are still in the office, including ones on their way out: the parent
   * only leaves the coffee machine after every delivery arrived.
   * @param {string} parentId
   * @returns {number}
   */
  childCountOf(parentId) {
    return this.controllers().filter(
      controller => controller.id !== parentId && controller.snapshot.parentId === parentId,
    ).length
  }

  /**
   * The parent to deliver to, falling back to the main agent when the parent is gone or leaving itself.
   * @param {string} parentId
   * @param {string} childId
   * @returns {Character | undefined}
   */
  parentCharacter(parentId, childId) {
    const parent = this.#entries.get(parentId)
    if (parent && parentId !== childId && !parent.controller.leaving) return parent.character
    return this.#entries.get(MAIN_AGENT_ID)?.character
  }
}
