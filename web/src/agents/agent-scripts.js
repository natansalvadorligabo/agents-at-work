import { DOOR_INSIDE, DOOR_OUTSIDE, SEATED_FACING, seatSide } from '../world/layout.js'
import { SEATED_POSES } from './poses.js'

/**
 * @typedef {import('../core/clock.js').Scheduler} Scheduler
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../models/props.js').DeliveryKind} DeliveryKind
 * @typedef {import('../world/layout.js').Point2} Point2
 * @typedef {import('./character.js').Character} Character
 * @typedef {import('./office-ports.js').OfficePorts} OfficePorts
 *
 * What a script needs from the agent it directs.
 * @typedef {object} ScriptActor
 * @property {Character} character
 * @property {(target: () => Point2, options?: { stopWithin?: number }) => Promise<void>} walkTo
 * @property {() => void} settleAtDesk
 *
 * @typedef {object} ScriptContext
 * @property {ScriptActor} actor
 * @property {OfficePorts} ports
 * @property {Scheduler} scheduler
 * @property {Translator} translator
 *
 * The parent met for a hand-off; `seat` is where it was sitting, when it got up for it. `done` hands the
 * parent over to the next visitor in line.
 * @typedef {{ parent: Character, seat: Point2 | null, done: () => void }} Meeting
 */

const TALKING_DISTANCE = 0.85
// Visitors waiting for a busy parent line up in front of it (towards the room, away from walls and its
// desk): columns of this many, this far apart, starting this far out.
const LINE_COLUMN = 4
const LINE_SPACING = 0.75
const LINE_START = [0.5, 1.5]
const LINE_DEEPEST_Z = 8.5
const HANDOFF_MS = 2600
const HANDOFF_FOCUS_MS = 3800
const EXTRA_WAIT_AT_COFFEE_MS = 1200
const SPILL_RUN_MS = 5000
const SPILL_BUBBLE_MS = 2800
const SPILL_FOCUS_MS = 2500
// Within this distance of its seat a parent counts as at its desk, and gets out of the chair to meet
// whoever brings or takes an envelope.
const SEAT_REACH = 0.9
// Both are frozen for the hand-off, so the crowd cannot part them: a visitor this close to where the
// parent steps out backs off to this distance first.
const HANDOFF_GAP = 0.8
const SIT_BACK_MS = 600
const WIND_UP_MS = 450
const SLAM_MS = 650
const FUMING_MS = 1300
const PUNCH_BUBBLE_MS = WIND_UP_MS + SLAM_MS + FUMING_MS
// The camera moves in from the wind-up until the fuming is well under way.
const PUNCH_FOCUS_MS = WIND_UP_MS + SLAM_MS + 900

/**
 * The line of visitors at each parent: the promise the next newcomer waits on, and how many are in line
 * (the one being served included).
 * @type {WeakMap<Character, { tail: Promise<void>, length: number }>}
 */
const lines = new WeakMap()

/**
 * Joins the line at a parent. One hand-off at a time: two at once pulled the parent back to its chair
 * mid-way through the second.
 * @param {Character} parent
 * @returns {{ place: number, turn: Promise<void>, done: () => void }} `place` 0 is served right away.
 */
function joinLine(parent) {
  const line = lines.get(parent) ?? { tail: Promise.resolve(), length: 0 }
  lines.set(parent, line)
  const before = line.tail
  /** @type {() => void} */
  let release = () => {}
  const served = new Promise(resolve => (release = () => resolve(undefined)))
  line.tail = before.then(() => served)
  const place = line.length++
  const done = () => {
    line.length--
    release()
  }
  return { place, turn: before, done }
}

/**
 * Where the visitor at a place in line waits: on open floor in front of the parent, never against a wall.
 * @param {Character} parent
 * @param {number} place 1 for the first one waiting.
 * @returns {Point2}
 */
function placeInLine(parent, place) {
  const column = Math.floor((place - 1) / LINE_COLUMN)
  const row = (place - 1) % LINE_COLUMN
  const [startX = 0, startZ = 0] = LINE_START
  const x = parent.position.x + startX + column * LINE_SPACING
  const z = Math.min(LINE_DEEPEST_Z, parent.position.z + startZ + row * LINE_SPACING)
  return [x, z]
}

/**
 * Walks up to the parent agent (following it if it moves), waits its turn a little way off if the parent
 * is busy with another visitor, then freezes both for the hand-off. A parent at its desk gets out of its
 * chair instead of twisting round in it.
 * @param {ScriptContext} context
 * @param {string} parentId
 * @returns {Promise<Meeting | null>}
 */
async function meetParent({ actor, ports }, parentId) {
  const { character } = actor
  const parent = () => ports.parentCharacter(parentId, character.id)
  const towardsParent = () => {
    const current = parent()
    return /** @type {Point2} */ (
      current ? [current.position.x, current.position.z] : [character.position.x, character.position.z]
    )
  }
  character.setPose('standing')
  const first = parent()
  if (!first) return null
  const { place, turn, done } = joinLine(first)
  if (place > 0) {
    const spot = placeInLine(first, place)
    await actor.walkTo(() => spot)
    character.lookAt(first.position.x, first.position.z)
  }
  await turn
  await actor.walkTo(towardsParent, { stopWithin: TALKING_DISTANCE })
  const met = parent()
  if (!met) {
    done()
    return null
  }
  for (const [who, other] of /** @type {const} */ ([
    [character, met],
    [met, character],
  ])) {
    who.lock(HANDOFF_MS)
    who.lookAt(other.position.x, other.position.z)
  }
  ports.focusOn([met, character], HANDOFF_FOCUS_MS)
  const seat = ports.seatOf(met.id)
  const spot = standUpFor(met, character, seat)
  if (spot) makeRoom(character, spot)
  return { parent: met, seat: spot ? seat : null, done }
}

/**
 * Gets a parent at its desk up and out beside its chair, on the visitor's side (the backrest faces the
 * room, so never through it). Judged by where it is, not by its pose: between two hand-offs it may be on
 * its way back to the seat.
 * @param {Character} parent
 * @param {Character} visitor
 * @param {Point2} seat
 * @returns {Point2 | null} Where it steps to, or null when it was away from its desk and stays put.
 */
function standUpFor(parent, visitor, seat) {
  const { x, z } = parent.position
  if (!SEATED_POSES.has(parent.pose) && Math.hypot(x - seat[0], z - seat[1]) > SEAT_REACH) return null
  const spot = seatSide(seat, [visitor.position.x, visitor.position.z])
  parent.setPose('standing')
  parent.followPath([spot])
  return spot
}

/**
 * Backs the visitor off from where the parent is stepping to, so the two never stand inside each other.
 * @param {Character} visitor
 * @param {Point2} spot
 */
function makeRoom(visitor, [spotX, spotZ]) {
  const dx = visitor.position.x - spotX
  const dz = visitor.position.z - spotZ
  const distance = Math.hypot(dx, dz)
  if (distance >= HANDOFF_GAP) return
  // Straight away from the spot; one on top of it backs into the room, away from the desk.
  const [awayX, awayZ] = distance > 0.01 ? [dx / distance, dz / distance] : [0, 1]
  visitor.followPath([[spotX + awayX * HANDOFF_GAP, spotZ + awayZ * HANDOFF_GAP]])
}

/**
 * Once both have stepped into place (which turned them away), they face each other, and the parent stays
 * put until it sits back down, however long the envelope takes, so it never sits down in front of its chair.
 * @param {Character} parent
 * @param {Character} visitor
 */
function faceEachOther(parent, visitor) {
  parent.lock(HANDOFF_MS)
  parent.lookAt(visitor.position.x, visitor.position.z)
  visitor.lookAt(parent.position.x, parent.position.z)
}

/**
 * After the hand-off, a parent that got up for it walks back to its seat and sits down.
 * @param {Meeting} meeting
 */
function sitBackDown({ parent, seat }) {
  if (!seat) return
  parent.lock(SIT_BACK_MS)
  parent.followPath([seat])
  parent.face(SEATED_FACING)
  // Seated from now on: it walks the step back and sits as it reaches the seat, never standing in the chair.
  parent.setPose('seated')
}

/**
 * A new subagent comes in through the door, gets its task envelope from its parent and sits down.
 * @param {ScriptContext} context
 * @param {string} parentId
 * @example scripts.enqueue(() => arrivalScript(context, 'main'))
 */
export async function arrivalScript(context, parentId) {
  const { actor, ports } = context
  const { character } = actor
  await actor.walkTo(() => DOOR_INSIDE)
  const meeting = await meetParent(context, parentId)
  if (meeting) {
    try {
      await receiveTask(context, meeting.parent)
      sitBackDown(meeting)
    } finally {
      meeting.done()
    }
  }
  await actor.walkTo(() => ports.seatOf(character.id))
  character.dropCarried()
  character.face(SEATED_FACING)
  actor.settleAtDesk()
}

/**
 * @param {ScriptContext} context
 * @param {Character} parent
 */
async function receiveTask({ actor, ports, scheduler, translator }, parent) {
  const { character } = actor
  const description = character.snapshot.description || character.snapshot.agentType
  parent.bubble.show(translator.t('bubble.task', { description }), { durationMs: HANDOFF_MS, priority: true })
  await scheduler.wait(500)
  faceEachOther(parent, character)
  parent.setPose('handingOver')
  await scheduler.wait(400)
  await ports.deliver(parent, character, 'task')
  character.bubble.show(translator.t('bubble.gotIt'), { durationMs: 1200, priority: true })
  await scheduler.wait(700)
  parent.setPose('standing')
}

/**
 * A finished subagent takes its result to the parent (complaining if it has to find them at the coffee
 * machine), then leaves through the door and is removed.
 * @param {ScriptContext} context
 * @param {string} parentId
 * @param {boolean} succeeded
 * @example scripts.enqueue(() => departureScript(context, 'main', true))
 */
export async function departureScript(context, parentId, succeeded) {
  const { actor, ports, scheduler, translator } = context
  const { character } = actor
  const kind = succeeded ? 'result' : 'failure'
  character.carry(kind)
  character.bubble.show(translator.t(succeeded ? 'bubble.done' : 'bubble.failed'), {
    durationMs: 1600,
    priority: true,
  })
  character.setPose('standing')
  await scheduler.wait(500)
  const meeting = await meetParent(context, parentId)
  if (meeting) {
    try {
      await handOverResult(context, meeting.parent, kind)
      sitBackDown(meeting)
    } finally {
      meeting.done()
    }
  }
  await actor.walkTo(() => DOOR_INSIDE)
  await actor.walkTo(() => DOOR_OUTSIDE)
  character.disappear()
  ports.playSound('poof')
  await scheduler.wait(400)
  ports.removeAgent(character.id)
}

/**
 * @param {ScriptContext} context
 * @param {Character} parent
 * @param {DeliveryKind} kind
 */
async function handOverResult({ actor, ports, scheduler, translator }, parent, kind) {
  const { character } = actor
  if (ports.isAtCoffee(parent.id)) {
    parent.lock(HANDOFF_MS + EXTRA_WAIT_AT_COFFEE_MS)
    character.bubble.show(translator.t('bubble.foundBossAtCoffee'), {
      durationMs: EXTRA_WAIT_AT_COFFEE_MS + 200,
      priority: true,
    })
    await scheduler.wait(EXTRA_WAIT_AT_COFFEE_MS)
  }
  character.setPose('handingOver')
  await scheduler.wait(400)
  faceEachOther(parent, character)
  await ports.deliver(character, parent, kind)
  ports.playSound(kind === 'result' ? 'success' : 'failure')
  const received = translator.t(kind === 'result' ? 'bubble.received' : 'bubble.receivedWithFailure')
  parent.bubble.show(received, { durationMs: 1600, priority: true })
  character.setPose('standing')
  scheduler.after(1800, () => parent.dropCarried())
  await scheduler.wait(700)
}

/**
 * Another tool failed right after the last one: the agent goes back to its desk if it is not there, raises
 * its fist, punches the desk (which shakes, monitor and all) and sits there fuming.
 * @param {ScriptContext} context
 * @example scripts.enqueue(() => deskPunchScript(context))
 */
export async function deskPunchScript({ actor, ports, scheduler, translator }) {
  const { character } = actor
  character.bubble.show(translator.t('bubble.punch'), { durationMs: PUNCH_BUBBLE_MS, priority: true })
  const [x, z] = ports.seatOf(character.id)
  if (Math.hypot(character.position.x - x, character.position.z - z) > 0.1) {
    character.setPose('standing')
    character.run(PUNCH_BUBBLE_MS)
    await actor.walkTo(() => [x, z])
  }
  character.face(SEATED_FACING)
  ports.focusOn([character], PUNCH_FOCUS_MS)
  character.setPose('windingUp')
  await scheduler.wait(WIND_UP_MS)
  character.setPose('slamming')
  character.shake(SLAM_MS)
  ports.punchDesk(character.id)
  await scheduler.wait(SLAM_MS)
  character.setPose('fuming')
  await scheduler.wait(FUMING_MS)
  actor.settleAtDesk()
}

/**
 * The command the agent was waiting on failed: it drops the coffee, leaves a puddle and runs back to its desk.
 * @param {ScriptContext} context
 * @example scripts.enqueue(() => spillScript(context))
 */
export async function spillScript({ actor, ports, scheduler, translator }) {
  const { character } = actor
  const { x, z } = character.position
  character.setPose('standing')
  character.bubble.show(translator.t('coffee.spilled'), { durationMs: SPILL_BUBBLE_MS, priority: true })
  ports.spillCoffee(x + 0.2, z)
  ports.playSound('splash')
  ports.focusOn([character], SPILL_FOCUS_MS)
  await scheduler.wait(600)
  character.run(SPILL_RUN_MS)
  await actor.walkTo(() => ports.seatOf(character.id))
  character.face(SEATED_FACING)
}
