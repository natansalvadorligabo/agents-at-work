/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 *
 * @typedef {object} TemperSituation
 * @property {AgentSnapshot} snapshot
 * @property {number} now Epoch milliseconds.
 * @property {boolean} atCoffee On a coffee break: failures there spill the coffee instead.
 * @property {string | null} coffeeToolId The command that sent the agent for coffee, if any.
 *
 * @typedef {'grumble' | 'punch'} Outburst
 */

/** Only failures this recent count: older ones arrive with a snapshot when the page (re)loads. */
export const FRESH_FAILURE_MS = 10000
/** A second failure within this long of the previous one makes the agent punch its desk. */
export const PUNCH_STREAK_MS = 120000
/** At most one punch per agent in this long; failures in between only make it grumble. */
export const PUNCH_COOLDOWN_MS = 15000
// Only the newest history entries can hold a failure that has not been seen yet.
const RECENT_HISTORY = 8

/**
 * Notices an agent's failed tool calls and decides how it reacts: the first failure gets a grumble, a
 * second one within two minutes a punch on the desk. Failures of the command it went for coffee over are
 * left to the coffee break (spilled coffee), and nothing happens while it is at the coffee machine.
 * @example
 * const temper = new Temper()
 * temper.react({ snapshot, now: Date.now(), atCoffee: false, coffeeToolId: null }) // 'grumble'
 */
export class Temper {
  /** @type {Set<string>} */
  #seen = new Set()
  #lastFailureAt = -Infinity
  #lastPunchAt = -Infinity

  /**
   * @param {TemperSituation} situation
   * @returns {Outburst | null}
   */
  react({ snapshot, now, atCoffee, coffeeToolId }) {
    const failures = snapshot.history
      .slice(-RECENT_HISTORY)
      .filter(record => record.failed && record.endedAt !== null && !this.#seen.has(record.id))
    if (failures.length === 0) return null
    for (const record of failures) this.#seen.add(record.id)
    const fresh = failures.filter(
      record => now - (record.endedAt ?? 0) <= FRESH_FAILURE_MS && record.id !== coffeeToolId,
    )
    if (fresh.length === 0 || atCoffee) return null
    return this.#outburst(now, fresh.length)
  }

  /**
   * @param {number} now
   * @param {number} count Fresh failures noticed at once (parallel tool calls).
   * @returns {Outburst}
   */
  #outburst(now, count) {
    const streak = count > 1 || now - this.#lastFailureAt <= PUNCH_STREAK_MS
    this.#lastFailureAt = now
    if (!streak || now - this.#lastPunchAt < PUNCH_COOLDOWN_MS) return 'grumble'
    this.#lastPunchAt = now
    return 'punch'
  }
}
