import { DOOR_INSIDE, isInsideRoom } from './layout.js'

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
