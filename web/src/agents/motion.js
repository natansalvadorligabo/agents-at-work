/** @typedef {{ x: number, z: number }} FloorPosition */

/**
 * Moves an angle towards a target along the shortest way around the circle.
 * @param {number} current
 * @param {number} target
 * @param {number} factor 0 keeps the current angle, 1 reaches the target.
 * @returns {number}
 * @example lerpAngle(3, -3, 1) // ≈ -3, turning through π rather than through 0
 */
export function lerpAngle(current, target, factor) {
  let difference = target - current
  while (difference > Math.PI) difference -= Math.PI * 2
  while (difference < -Math.PI) difference += Math.PI * 2
  return current + difference * factor
}

/**
 * @param {number} current
 * @param {number} target
 * @param {number} factor
 * @returns {number}
 * @example approach(0, 10, 0.5) // 5
 */
export function approach(current, target, factor) {
  return current + (target - current) * factor
}

/**
 * Advances a position along waypoints by a distance, consuming the waypoints it reaches.
 * @param {FloorPosition} position Mutated in place.
 * @param {FloorPosition[]} waypoints Mutated: reached waypoints are removed.
 * @param {number} distance
 * @returns {number | null} The heading of the last segment walked, or null when standing still.
 * @example advanceAlongPath({ x: 0, z: 0 }, [{ x: 1, z: 0 }], 0.5) // heading π/2, position { x: 0.5, z: 0 }
 */
export function advanceAlongPath(position, waypoints, distance) {
  let remaining = distance
  /** @type {number | null} */
  let heading = null
  while (remaining > 0 && waypoints.length > 0) {
    const target = /** @type {FloorPosition} */ (waypoints[0])
    const dx = target.x - position.x
    const dz = target.z - position.z
    const gap = Math.hypot(dx, dz)
    if (gap > 0.001) heading = Math.atan2(dx, dz)
    remaining -= stepTowards(position, target, gap, remaining, waypoints)
  }
  return heading
}

/**
 * @param {FloorPosition} position
 * @param {FloorPosition} target
 * @param {number} gap
 * @param {number} budget
 * @param {FloorPosition[]} waypoints
 * @returns {number} Distance used.
 */
function stepTowards(position, target, gap, budget, waypoints) {
  if (gap <= budget) {
    position.x = target.x
    position.z = target.z
    waypoints.shift()
    return gap
  }
  position.x += ((target.x - position.x) / gap) * budget
  position.z += ((target.z - position.z) / gap) * budget
  return budget
}
