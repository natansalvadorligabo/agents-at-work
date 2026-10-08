/**
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {Pick<AgentSnapshot, 'id' | 'agentType' | 'name' | 'description'>} AgentIdentity
 *
 * @typedef {object} CoffeeRecord
 * @property {AgentIdentity} agent
 * @property {number} cups
 * @property {number} msAtCoffee Closed breaks only; the open one is added on read.
 * @property {number | null} since Start of the open break, or null when not at the coffee machine.
 *
 * @typedef {object} CoffeeStat
 * @property {number} cups
 * @property {number} msAtCoffee
 * @property {boolean} atCoffee
 *
 * @typedef {CoffeeStat & { agent: AgentIdentity }} CoffeeRankingRow
 */

/** @type {CoffeeStat} */
const NO_COFFEE = Object.freeze({ cups: 0, msAtCoffee: 0, atCoffee: false })

/**
 * Counts cups and time at the coffee machine per agent, for the "employee of the month" ranking.
 * Records outlive the agents, so the ranking keeps subagents that already went home.
 * @example
 * const stats = new CoffeeStats(systemClock)
 * stats.arrive(snapshot) // 1
 * stats.leave(snapshot.id)
 */
export class CoffeeStats {
  /** @type {Map<string, CoffeeRecord>} */
  #records = new Map()
  #clock

  /** @param {Clock} clock */
  constructor(clock) {
    this.#clock = clock
  }

  /**
   * Opens a coffee break and returns how many cups the agent has had, this one included.
   * @param {AgentIdentity} agent
   * @returns {number}
   */
  arrive(agent) {
    const record = this.#records.get(agent.id) ?? { agent, cups: 0, msAtCoffee: 0, since: null }
    record.agent = agent
    record.cups++
    record.since = this.#clock.now()
    this.#records.set(agent.id, record)
    return record.cups
  }

  /** @param {string} agentId */
  leave(agentId) {
    const record = this.#records.get(agentId)
    if (!record || record.since === null) return
    record.msAtCoffee += this.#clock.now() - record.since
    record.since = null
  }

  /** Ends every open break without counting it, for when the scene is rebuilt from a snapshot. */
  abandonOpenBreaks() {
    for (const record of this.#records.values()) record.since = null
  }

  /**
   * @param {string} agentId
   * @returns {CoffeeStat}
   */
  statFor(agentId) {
    const record = this.#records.get(agentId)
    return record ? this.#toStat(record) : NO_COFFEE
  }

  /**
   * Longest time at the coffee machine first; cups break ties.
   * @returns {CoffeeRankingRow[]}
   */
  ranking() {
    return [...this.#records.values()]
      .map(record => ({ agent: record.agent, ...this.#toStat(record) }))
      .sort((a, b) => b.msAtCoffee - a.msAtCoffee || b.cups - a.cups)
  }

  /**
   * @param {CoffeeRecord} record
   * @returns {CoffeeStat}
   */
  #toStat(record) {
    const openBreak = record.since === null ? 0 : this.#clock.now() - record.since
    return { cups: record.cups, msAtCoffee: record.msAtCoffee + openBreak, atCoffee: record.since !== null }
  }
}
