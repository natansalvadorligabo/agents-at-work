import { STATIONS } from './layout.js'

/**
 * @typedef {import('./layout.js').Point2} Point2
 * @typedef {import('./layout.js').StationName} StationName
 */

// Where extra agents stand around a busy station, relative to its main spot: beside it, then behind.
const OFFSETS = /** @type {readonly Point2[]} */ ([
  [0, 0],
  [-0.65, 0.2],
  [0.65, 0.2],
  [-0.35, 0.85],
  [0.35, 0.85],
])

/**
 * Hands out standing spots around each station, so several agents using the server rack at once stand
 * side by side instead of on top of each other. Each agent holds at most one spot.
 * @example
 * const spots = new StationSpots()
 * spots.occupy('agent-1', 'rack') // [6.5, 1.45]
 * spots.occupy('agent-2', 'rack') // [5.85, 1.65]
 */
export class StationSpots {
  /** @type {Map<StationName, (string | null)[]>} */
  #occupants = new Map()

  /**
   * Returns the agent's spot at the station, giving up any spot it held elsewhere.
   * @param {string} agentId
   * @param {StationName} station
   * @returns {Point2}
   */
  occupy(agentId, station) {
    const occupants = this.#occupantsOf(station)
    let index = occupants.indexOf(agentId)
    if (index === -1) {
      this.release(agentId)
      const free = occupants.indexOf(null)
      index = free === -1 ? occupants.length : free
      occupants[index] = agentId
    }
    const [x, z] = STATIONS[station].point
    const [dx, dz] = OFFSETS[index % OFFSETS.length] ?? [0, 0]
    // Past the last offset, spots repeat one row further back.
    const row = Math.floor(index / OFFSETS.length)
    return [x + dx, z + dz + row * 0.85]
  }

  /** @param {string} agentId */
  release(agentId) {
    for (const occupants of this.#occupants.values()) {
      const index = occupants.indexOf(agentId)
      if (index !== -1) occupants[index] = null
    }
  }

  clear() {
    this.#occupants.clear()
  }

  /**
   * @param {StationName} station
   * @returns {(string | null)[]}
   */
  #occupantsOf(station) {
    let occupants = this.#occupants.get(station)
    if (!occupants) this.#occupants.set(station, (occupants = []))
    return occupants
  }
}
