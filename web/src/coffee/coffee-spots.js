import { COFFEE_SPOTS } from '../world/layout.js'

/** @typedef {import('../world/layout.js').Point2} Point2 */

const SECOND_RING_OFFSET = 0.6

/**
 * Hands out standing spots in front of the coffee counter. Spots freed by someone leaving are reused first;
 * when all are taken, latecomers stand in a second ring next to the first.
 * @example
 * const spots = new CoffeeSpots()
 * spots.occupy('agent-1') // [1.0, 4.45]
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
    const [x, z] = /** @type {Point2} */ (COFFEE_SPOTS[index % COFFEE_SPOTS.length])
    return index < COFFEE_SPOTS.length ? [x, z] : [x + SECOND_RING_OFFSET, z]
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
