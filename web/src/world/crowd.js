/** @typedef {{ x: number, z: number }} FloorPosition */

const MIN_DISTANCE = 0.55
const PUSH_SPEED = 1.5

/**
 * Nudges standing characters apart so they do not overlap (seated and locked ones are passed in as fixed
 * by simply leaving them out).
 * @param {FloorPosition[]} positions Mutated in place.
 * @param {number} seconds
 * @example separateCrowd([{ x: 0, z: 0 }, { x: 0.1, z: 0 }], 0.016)
 */
export function separateCrowd(positions, seconds) {
  positions.forEach((a, i) => {
    for (const [j, b] of positions.entries()) if (j > i) pushApart(a, b, i + j, seconds)
  })
}

/**
 * @param {FloorPosition} a
 * @param {FloorPosition} b
 * @param {number} tieBreakAngle Direction used when both stand on exactly the same spot.
 * @param {number} seconds
 */
function pushApart(a, b, tieBreakAngle, seconds) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const distance = Math.hypot(dx, dz)
  if (distance >= MIN_DISTANCE) return
  const angle = distance > 0.001 ? Math.atan2(dz, dx) : tieBreakAngle
  const push = Math.min(MIN_DISTANCE - distance, seconds * PUSH_SPEED) / 2
  a.x -= Math.cos(angle) * push
  a.z -= Math.sin(angle) * push
  b.x += Math.cos(angle) * push
  b.z += Math.sin(angle) * push
}
