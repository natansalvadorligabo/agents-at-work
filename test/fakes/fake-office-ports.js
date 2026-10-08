import { planRoute } from '../../web/src/world/navigation.js'
import { PathGrid } from '../../web/src/world/path-grid.js'

/** @typedef {import('../../web/src/agents/character.js').Character} Character */

/**
 * OfficePorts backed by plain fields, recording what the controller asked for.
 * Routes are planned on a real (empty) grid so walking works like in the office.
 */
export class FakeOfficePorts {
  grid = new PathGrid(14, 9)
  /** @type {Map<string, [number, number]>} */
  seats = new Map()
  /** @type {Map<string, number>} */
  cups = new Map()
  /** @type {string[]} */
  coffeeOccupants = []
  /** @type {[number, number][]} */
  spills = []
  /** @type {string[]} */
  removed = []
  /** @type {{ from: string, to: string, kind: string }[]} */
  deliveries = []
  /** @type {Map<string, Character>} */
  characters = new Map()
  /** @type {Set<string>} */
  atCoffee = new Set()
  childCount = 0
  idle = false

  planRoute = (
    /** @type {{ x: number, z: number }} */ position,
    /** @type {[number, number]} */ destination,
  ) => planRoute(this.grid, position, destination)
  seatOf = (/** @type {string} */ agentId) => this.seats.get(agentId) ?? [5, 4.3]
  occupyCoffeeSpot = (/** @type {string} */ agentId) => {
    if (!this.coffeeOccupants.includes(agentId)) this.coffeeOccupants.push(agentId)
    return /** @type {[number, number]} */ ([1, 4.45 + this.coffeeOccupants.indexOf(agentId)])
  }
  releaseCoffeeSpot = (/** @type {string} */ agentId) => {
    this.coffeeOccupants = this.coffeeOccupants.filter(id => id !== agentId)
  }
  recordCoffeeArrival = (/** @type {{ id: string }} */ agent) => {
    this.cups.set(agent.id, (this.cups.get(agent.id) ?? 0) + 1)
    return this.cups.get(agent.id) ?? 0
  }
  recordCoffeeDeparture = () => {}
  spillCoffee = (/** @type {number} */ x, /** @type {number} */ z) => void this.spills.push([x, z])
  focusOn = () => {}
  deliver = async (
    /** @type {Character} */ from,
    /** @type {Character} */ to,
    /** @type {string} */ kind,
  ) => {
    this.deliveries.push({ from: from.id, to: to.id, kind })
  }
  parentCharacter = (/** @type {string} */ parentId) => this.characters.get(parentId)
  isAtCoffee = (/** @type {string} */ agentId) => this.atCoffee.has(agentId)
  childCountOf = () => this.childCount
  removeAgent = (/** @type {string} */ agentId) => void this.removed.push(agentId)
  isIdle = () => this.idle
}
