import { createDeskSet } from './furniture-placement.js'
import { DOOR_INSIDE, deskSlotTile, seatAt } from './layout.js'

/**
 * @typedef {import('../lib/three.js').Scene} Scene
 * @typedef {import('../lib/three.js').Group} Group
 * @typedef {import('./layout.js').Point2} Point2
 * @typedef {{ set: Group, scale: number, targetScale: number }} DeskEntry
 */

const GROW_SPEED = 2.4
const SHRINK_SPEED = 3
const BOUNCE = 0.18

/**
 * Gives each subagent its own desk, popping desks in and out with a little bounce. The lowest free slot is
 * reused, so the room grows to the right only when every desk is taken.
 * @example
 * const desks = new DeskSlots(scene, () => room.refresh())
 * desks.occupy('agent-1') // 0
 * desks.seatOf('agent-1') // [6, 4.3]
 */
export class DeskSlots {
  /** @type {Map<string, number>} */
  #slotByAgent = new Map()
  /** @type {Map<number, DeskEntry>} */
  #desks = new Map()
  #scene
  #onLayoutChange

  /**
   * @param {Scene} scene
   * @param {() => void} onLayoutChange Called when the set of desks on the floor changes.
   */
  constructor(scene, onLayoutChange) {
    this.#scene = scene
    this.#onLayoutChange = onLayoutChange
  }

  /** @returns {number[]} Slots with a desk on the floor, including ones shrinking away. */
  occupiedSlots() {
    return [...this.#desks.keys()]
  }

  /**
   * @param {string} agentId
   * @returns {number}
   */
  occupy(agentId) {
    const existing = this.#slotByAgent.get(agentId)
    if (existing !== undefined) return existing
    let slot = 0
    while (this.#desks.has(slot)) slot++
    const set = createDeskSet()
    const { x, z } = deskSlotTile(slot)
    set.position.set(x + 1, 0, z + 0.5)
    this.#scene.add(set)
    this.#desks.set(slot, { set, scale: 0, targetScale: 1 })
    this.#slotByAgent.set(agentId, slot)
    this.#onLayoutChange()
    return slot
  }

  /**
   * Lets the agent's desk shrink away; it leaves the floor plan once it has vanished.
   * @param {string} agentId
   */
  release(agentId) {
    const slot = this.#slotByAgent.get(agentId)
    if (slot === undefined) return
    this.#slotByAgent.delete(agentId)
    const desk = this.#desks.get(slot)
    if (desk) desk.targetScale = 0
  }

  /**
   * Where the agent sits; agents without a desk wait just inside the door.
   * @param {string} agentId
   * @returns {Point2}
   */
  seatOf(agentId) {
    const slot = this.#slotByAgent.get(agentId)
    return slot === undefined ? DOOR_INSIDE : seatAt(deskSlotTile(slot))
  }

  /** Removes every desk at once, without animation. */
  clear() {
    for (const desk of this.#desks.values()) desk.set.removeFromParent()
    this.#desks.clear()
    this.#slotByAgent.clear()
  }

  /** @param {number} seconds */
  animate(seconds) {
    for (const [slot, desk] of this.#desks) this.#animateDesk(slot, desk, seconds)
  }

  /**
   * @param {number} slot
   * @param {DeskEntry} desk
   * @param {number} seconds
   */
  #animateDesk(slot, desk, seconds) {
    if (desk.scale === desk.targetScale) return
    const growing = desk.targetScale > desk.scale
    desk.scale = growing
      ? Math.min(desk.targetScale, desk.scale + seconds * GROW_SPEED)
      : Math.max(0, desk.scale - seconds * SHRINK_SPEED)
    const bounce = growing && desk.scale < 1 ? Math.sin(desk.scale * Math.PI) * BOUNCE : 0
    const scale = Math.max(0.001, desk.scale)
    desk.set.scale.set(scale + bounce * 0.5, scale + bounce, scale + bounce * 0.5)
    if (desk.targetScale > 0 || desk.scale > 0) return
    desk.set.removeFromParent()
    this.#desks.delete(slot)
    this.#onLayoutChange()
  }
}
