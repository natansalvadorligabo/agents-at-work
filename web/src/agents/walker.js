import { floorDistance, truncateWithinReach } from '../world/navigation.js'

/**
 * @typedef {import('../world/layout.js').Point2} Point2
 * @typedef {import('./character.js').Character} Character
 *
 * @typedef {object} WalkOrder
 * @property {() => Point2} target Re-read every frame: the target may be another agent who is moving.
 * @property {number} stopWithin
 * @property {() => void} resolve
 * @property {number} plannedAt
 * @property {{ x: number, z: number } | null} plannedFor
 *
 * @typedef {(position: { x: number, z: number }, destination: Point2) => Point2[]} RoutePlanner
 */

const ARRIVAL_TOLERANCE = 0.02
const DEFAULT_STOP_WITHIN = 0.05
const REPLAN_INTERVAL_MS = 450
const TARGET_MOVED_DISTANCE = 0.5
// Beyond this reach the walk is "up to someone", not "onto a spot", so the route is cut short.
const SHORT_STOP = 0.1

/**
 * Walks a character to a (possibly moving) target, replanning the route when the target moves away.
 * @example
 * const walker = new Walker(character, planRoute)
 * await walker.walkTo(() => [3, 4], { stopWithin: 0.85 }, Date.now()) // resolves on arrival
 */
export class Walker {
  /** @type {WalkOrder | null} */
  #order = null
  #character
  #planRoute

  /**
   * @param {Character} character
   * @param {RoutePlanner} planRoute
   */
  constructor(character, planRoute) {
    this.#character = character
    this.#planRoute = planRoute
  }

  get isWalking() {
    return this.#order !== null
  }

  /**
   * Replaces any walk in progress; the promise resolves when the character arrives.
   * @param {() => Point2} target
   * @param {{ stopWithin?: number }} [options]
   * @returns {Promise<void>}
   */
  walkTo(target, { stopWithin = DEFAULT_STOP_WITHIN } = {}) {
    return new Promise(resolve => {
      this.#order = { target, stopWithin, resolve, plannedAt: 0, plannedFor: null }
    })
  }

  /** @param {number} now */
  update(now) {
    const order = this.#order
    if (!order || this.#character.isLocked) return
    const [x, z] = order.target()
    const destination = { x, z }
    if (
      floorDistance(this.#character.position, destination) <= Math.max(order.stopWithin, ARRIVAL_TOLERANCE)
    ) {
      this.#character.waypoints = []
      return this.#finish(order)
    }
    if (this.#needsNewRoute(order, destination, now)) this.#replan(order, destination, now)
  }

  /**
   * @param {WalkOrder} order
   * @param {{ x: number, z: number }} destination
   * @param {number} now
   * @returns {boolean}
   */
  #needsNewRoute(order, destination, now) {
    if (!this.#character.isWalking) return true
    const targetMoved =
      !order.plannedFor || floorDistance(order.plannedFor, destination) > TARGET_MOVED_DISTANCE
    return targetMoved && now - order.plannedAt > REPLAN_INTERVAL_MS
  }

  /**
   * @param {WalkOrder} order
   * @param {{ x: number, z: number }} destination
   * @param {number} now
   */
  #replan(order, destination, now) {
    order.plannedAt = now
    order.plannedFor = destination
    const route = this.#planRoute(this.#character.position, [destination.x, destination.z])
    if (order.stopWithin <= SHORT_STOP) return this.#character.followPath(route)
    const shortened = truncateWithinReach(route, destination, order.stopWithin)
    this.#character.followPath(shortened)
    if (shortened.length === 0) this.#finish(order)
  }

  /** @param {WalkOrder} order */
  #finish(order) {
    if (this.#order === order) this.#order = null
    order.resolve()
  }
}
