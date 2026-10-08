/**
 * @typedef {{ x: number, z: number }} FloorPosition
 *
 * One body on the floor.
 * @typedef {object} CrowdMember
 * @property {FloorPosition} position Mutated in place, unless `fixed`.
 * @property {boolean} fixed Seated or frozen in a hand-off: others step around it, it is never pushed.
 * @property {FloorPosition | null} heading The next point it walks towards, or null when standing still.
 *
 * @typedef {(x: number, z: number) => boolean} StandingCheck Whether a body may stand at a floor point.
 */

/** Bodies closer than this overlap. */
export const PERSONAL_SPACE = 0.55
const PUSH_SPEED = 2.2
// A walker starts stepping aside when someone is this close ahead of it.
const LOOKAHEAD = 1.0
const SIDESTEP_SPEED = 1.1
// How far off the walking line (in units of personal space) someone still counts as "in the way".
const IN_THE_WAY = 1.1

/**
 * Keeps bodies from overlapping: overlapping ones are pushed apart (fixed ones push without moving) and
 * walkers step aside around anyone standing in their way. A move that would put someone inside furniture
 * or a wall is dropped.
 * @param {CrowdMember[]} members
 * @param {number} seconds
 * @param {StandingCheck} canStand
 * @example separateCrowd([{ position: { x: 0, z: 0 }, fixed: false, heading: null }], 0.016, () => true)
 */
export function separateCrowd(members, seconds, canStand) {
  const moves = members.map(() => ({ x: 0, z: 0 }))
  members.forEach((a, i) => {
    for (const [j, b] of members.entries()) {
      if (j > i) pushApart([a, b], [moves[i], moves[j]], i + j, seconds)
    }
  })
  members.forEach((member, i) => {
    const move = moves[i]
    if (member.fixed || !move) return
    addSidestep(member, members, move, seconds)
    applyMove(member.position, move, canStand)
  })
}

/**
 * @param {[CrowdMember, CrowdMember]} pair
 * @param {[FloorPosition | undefined, FloorPosition | undefined]} moves
 * @param {number} tieBreakAngle Direction used when both stand on exactly the same spot.
 * @param {number} seconds
 */
function pushApart([a, b], [moveA, moveB], tieBreakAngle, seconds) {
  if ((a.fixed && b.fixed) || !moveA || !moveB) return
  const dx = b.position.x - a.position.x
  const dz = b.position.z - a.position.z
  const distance = Math.hypot(dx, dz)
  if (distance >= PERSONAL_SPACE) return
  const angle = distance > 0.001 ? Math.atan2(dz, dx) : tieBreakAngle
  const push = Math.min(PERSONAL_SPACE - distance, seconds * PUSH_SPEED)
  const [shareA, shareB] = a.fixed ? [0, 1] : b.fixed ? [1, 0] : [0.5, 0.5]
  moveA.x -= Math.cos(angle) * push * shareA
  moveA.z -= Math.sin(angle) * push * shareA
  moveB.x += Math.cos(angle) * push * shareB
  moveB.z += Math.sin(angle) * push * shareB
}

/**
 * Steers a walker sideways around the closest body ahead of it, away from the side that body is on (to
 * its right when the other is dead ahead), so two walkers meeting head-on pass each other.
 * @param {CrowdMember} walker
 * @param {CrowdMember[]} members
 * @param {FloorPosition} move
 * @param {number} seconds
 */
function addSidestep(walker, members, move, seconds) {
  const { heading, position } = walker
  if (!heading) return
  const length = Math.hypot(heading.x - position.x, heading.z - position.z)
  if (length < 0.001) return
  const forward = { x: (heading.x - position.x) / length, z: (heading.z - position.z) / length }
  const blocker = closestAhead(walker, members, forward, length)
  if (!blocker) return
  // `across` is positive on the walker's left; its right is (-forward.z, forward.x) with z towards the viewer.
  const side = blocker.across < -0.02 ? -1 : 1
  const strength = SIDESTEP_SPEED * (1 - blocker.ahead / LOOKAHEAD) * seconds
  move.x += -forward.z * side * strength
  move.z += forward.x * side * strength
}

/**
 * @param {CrowdMember} walker
 * @param {CrowdMember[]} members
 * @param {FloorPosition} forward Unit walking direction.
 * @param {number} distanceToWaypoint Nobody well beyond the waypoint is in the way.
 * @returns {{ ahead: number, across: number } | null} How far ahead and how far to the side (left positive).
 */
function closestAhead(walker, members, forward, distanceToWaypoint) {
  /** @type {{ ahead: number, across: number } | null} */
  let closest = null
  for (const other of members) {
    if (other === walker) continue
    const dx = other.position.x - walker.position.x
    const dz = other.position.z - walker.position.z
    const ahead = dx * forward.x + dz * forward.z
    const across = dx * forward.z - dz * forward.x
    if (ahead <= 0 || ahead > Math.min(LOOKAHEAD, distanceToWaypoint + PERSONAL_SPACE)) continue
    if (Math.abs(across) > PERSONAL_SPACE * IN_THE_WAY) continue
    if (!closest || ahead < closest.ahead) closest = { ahead, across }
  }
  return closest
}

/**
 * @param {FloorPosition} position
 * @param {FloorPosition} move
 * @param {StandingCheck} canStand
 */
function applyMove(position, move, canStand) {
  if (move.x === 0 && move.z === 0) return
  const x = position.x + move.x
  const z = position.z + move.z
  // Someone already standing somewhere odd may always move out of it.
  if (canStand(x, z) || !canStand(position.x, position.z)) {
    position.x = x
    position.z = z
  } else if (canStand(x, position.z)) position.x = x
  else if (canStand(position.x, z)) position.z = z
}
