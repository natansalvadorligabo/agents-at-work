import { DOOR_INSIDE, DOOR_OUTSIDE, SEATED_FACING } from '../world/layout.js'
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
 * The parent met for a hand-off; `seat` is where it was sitting, when it got up for it.
 * @typedef {{ parent: Character, seat: Point2 | null }} Meeting
 */

const TALKING_DISTANCE = 0.85
const HANDOFF_MS = 2600
const HANDOFF_FOCUS_MS = 3800
const EXTRA_WAIT_AT_COFFEE_MS = 1200
const SPILL_RUN_MS = 5000
const SPILL_BUBBLE_MS = 2800
const SPILL_FOCUS_MS = 2500
// A seated parent steps this far out from its desk to face whoever brings or takes an envelope.
const STAND_UP_STEP = 0.3
const SIT_BACK_MS = 600
const WIND_UP_MS = 450
const SLAM_MS = 650
const FUMING_MS = 1300
const PUNCH_BUBBLE_MS = WIND_UP_MS + SLAM_MS + FUMING_MS

/**
 * Walks up to the parent agent (following it if it moves) and freezes both for the hand-off. A seated
 * parent gets up and steps towards the visitor instead of twisting round in its chair.
 * @param {ScriptContext} context
 * @param {string} parentId
 * @returns {Promise<Meeting | null>}
 */
async function meetParent({ actor, ports }, parentId) {
  const { character } = actor
  const parent = () => ports.parentCharacter(parentId, character.id)
  character.setPose('standing')
  await actor.walkTo(
    () => {
      const current = parent()
      return current ? [current.position.x, current.position.z] : [character.position.x, character.position.z]
    },
    { stopWithin: TALKING_DISTANCE },
  )
  const met = parent()
  if (!met) return null
  for (const [who, other] of /** @type {const} */ ([
    [character, met],
    [met, character],
  ])) {
    who.lock(HANDOFF_MS)
    who.lookAt(other.position.x, other.position.z)
  }
  ports.focusOn([met, character], HANDOFF_FOCUS_MS)
  return { parent: met, seat: standUpFor(met, character) }
}

/**
 * Gets a seated character up and walking a step towards a visitor; it ends facing them.
 * @param {Character} seated
 * @param {Character} visitor
 * @returns {Point2 | null} The seat it left, or null when it was not sitting.
 */
function standUpFor(seated, visitor) {
  if (!SEATED_POSES.has(seated.pose)) return null
  const seat = /** @type {Point2} */ ([seated.position.x, seated.position.z])
  // Never towards the desk, which is behind the seat (smaller z).
  const dx = visitor.position.x - seat[0]
  const dz = Math.max(0, visitor.position.z - seat[1])
  const length = Math.hypot(dx, dz)
  const [stepX, stepZ] = length > 0.001 ? [dx / length, dz / length] : [0, 1]
  seated.setPose('standing')
  seated.followPath([[seat[0] + stepX * STAND_UP_STEP, seat[1] + stepZ * STAND_UP_STEP]])
  return seat
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
    await receiveTask(context, meeting.parent)
    sitBackDown(meeting)
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
  parent.setPose('handingOver')
  await scheduler.wait(900)
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
    await handOverResult(context, meeting.parent, kind)
    sitBackDown(meeting)
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
