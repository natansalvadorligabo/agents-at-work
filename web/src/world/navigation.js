import { DOOR_INSIDE, isInsideRoom } from './layout.js'

const WALL_CLEARANCE = 0.3
const DOOR_HALF_WIDTH = 0.4

/**
 * @typedef {import('./layout.js').Point2} Point2
 * @typedef {import('./path-grid.js').PathGrid} PathGrid
 * @typedef {{ x: number, z: number }} FloorPosition
 */

/**
 * Plans a walk between two floor positions as a list of waypoints at tile centers, ending exactly on the
 * destination. Anything outside the room is reached through the door, the only opening.
 * @param {PathGrid} grid
 * @param {FloorPosition} position
 * @param {Point2} destination
 * @returns {Point2[]}
 * @example planRoute(grid, { x: -1.1, z: 6.5 }, [2, 4.3]) // enters through the door, then to the seat
 */
export function planRoute(grid, position, destination) {
  /** @type {Point2[]} */
  const waypoints = []
  let origin = /** @type {Point2} */ ([position.x, position.z])
  if (!isInsideRoom(origin[0], origin[1], grid.width)) {
    waypoints.push(DOOR_INSIDE)
    origin = DOOR_INSIDE
  }
  const insideTarget = isInsideRoom(destination[0], destination[1], grid.width) ? destination : DOOR_INSIDE
  const cells = grid.findPath(toCell(origin), toCell(insideTarget))
  for (const [x, z] of cells.slice(0, -1)) waypoints.push([x + 0.5, z + 0.5])
  waypoints.push(insideTarget)
  if (insideTarget !== destination) waypoints.push(destination)
  return waypoints
}

// Walking past someone costs as much as a detour of this many tiles, so routes go around people.
const OCCUPIED_COST = 4
// Cells whose center is this close to someone count as taken by them (a seat on a tile edge takes two).
const OCCUPIED_REACH = 0.75

/**
 * Marks the cells taken by people standing or sitting still, replacing the previous marks.
 * @param {PathGrid} grid
 * @param {Iterable<FloorPosition>} positions
 * @example markOccupied(grid, [{ x: 2, z: 4.3 }]) // the seat's two cells now cost more to cross
 */
export function markOccupied(grid, positions) {
  grid.clearPenalties()
  for (const { x, z } of positions) {
    const [cellX, cellZ] = toCell([x, z])
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [cx, cz] = [cellX + dx, cellZ + dz]
        if (Math.hypot(cx + 0.5 - x, cz + 0.5 - z) <= OCCUPIED_REACH) grid.addPenalty(cx, cz, OCCUPIED_COST)
      }
    }
  }
}

/**
 * Whether a body can stand at a floor point: on a free tile inside the room, or in the corridor outside,
 * but never inside the left wall except through the door.
 * @param {PathGrid} grid
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 * @example canStandAt(grid, -1.1, 6.5) // true: the corridor outside the door
 */
export function canStandAt(grid, x, z) {
  if (isInsideRoom(x, z, grid.width)) return grid.isFree(Math.floor(x), Math.floor(z))
  return x <= -WALL_CLEARANCE || Math.abs(z - DOOR_INSIDE[1]) < DOOR_HALF_WIDTH
}

/**
 * @param {Point2} point
 * @returns {Point2}
 */
function toCell([x, z]) {
  return [Math.floor(x), Math.floor(z)]
}

/**
 * Cuts a route right after the first waypoint within `reach` of the target, for walks that stop short of
 * it (walking up to someone to talk).
 * @param {Point2[]} waypoints
 * @param {FloorPosition} target
 * @param {number} reach
 * @returns {Point2[]}
 * @example truncateWithinReach([[0, 0], [1, 0], [2, 0]], { x: 2, z: 0 }, 1) // [[0, 0], [1, 0]]
 */
export function truncateWithinReach(waypoints, target, reach) {
  const index = waypoints.findIndex(([x, z]) => Math.hypot(x - target.x, z - target.z) <= reach)
  return index === -1 ? waypoints : waypoints.slice(0, index + 1)
}

/**
 * Distance on the floor plane.
 * @param {FloorPosition} a
 * @param {FloorPosition} b
 * @returns {number}
 * @example floorDistance({ x: 0, z: 0 }, { x: 3, z: 4 }) // 5
 */
export function floorDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}
