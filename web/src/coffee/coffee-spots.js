import { COFFEE_SPOTS } from '../world/layout.js'

/** @typedef {import('../world/layout.js').Point2} Point2 */

// Latecomers stand past the right end of the counter, zigzagging over two rows. The room is always wide
// enough: it grows by a desk column (3 tiles) for every 2 subagents, and the line by half a tile per agent.
const OVERFLOW_START_X = 14.3
const OVERFLOW_STEP_X = 0.5
const OVERFLOW_ROWS = /** @type {const} */ ([1.3, 2.3])

/**
 * Hands out standing spots in front of the coffee counter. Spots freed by someone leaving are reused first;
 * when all are taken, latecomers line up past the end of the counter.
 * @example
 * const spots = new CoffeeSpots()
 * spots.occupy('agent-1') // [12.4, 1.3]
 */
export class CoffeeSpots {
  /** @type {(string | null)[]} */
  #occupants = []

  /**
   * Returns the agent's spot, assigning one if it has none yet.
   * @param {string} agentId
   * @returns {Point2}
   */
  occupy(agentId) {
    let index = this.#occupants.indexOf(agentId)
    if (index === -1) index = this.#assign(agentId)
    const spot = COFFEE_SPOTS[index]
    if (spot) return [spot[0], spot[1]]
    const place = index - COFFEE_SPOTS.length
    return [OVERFLOW_START_X + place * OVERFLOW_STEP_X, OVERFLOW_ROWS[place % 2] ?? OVERFLOW_ROWS[0]]
  }

  /** @param {string} agentId */
  release(agentId) {
    const index = this.#occupants.indexOf(agentId)
    if (index !== -1) this.#occupants[index] = null
  }

  clear() {
    this.#occupants = []
  }

  /**
   * @param {string} agentId
   * @returns {number}
   */
  #assign(agentId) {
    const free = this.#occupants.indexOf(null)
    const index = free === -1 ? this.#occupants.length : free
    this.#occupants[index] = agentId
    return index
  }
}
