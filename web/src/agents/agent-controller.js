import { CoffeeBreak } from '../coffee/coffee-break.js'
import { CoffeeReasoner } from '../coffee/coffee-rules.js'
import { COFFEE_FACING, SEATED_FACING, STATIONS } from '../world/layout.js'
import { newestActiveTool, planActivity } from './activity-planner.js'
import { arrivalScript, departureScript, deskPunchScript, spillScript } from './agent-scripts.js'
import { ScriptQueue } from './script-queue.js'
import { Temper } from './temper.js'
import { Walker } from './walker.js'

/**
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../core/clock.js').Scheduler} Scheduler
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../world/layout.js').Point2} Point2
 * @typedef {import('../coffee/gossip.js').GossipParticipant} GossipParticipant
 * @typedef {import('./activity-planner.js').TargetName} TargetName
 * @typedef {import('./agent-scripts.js').ScriptContext} ScriptContext
 * @typedef {import('./character.js').Character} Character
 * @typedef {import('./office-ports.js').OfficePorts} OfficePorts
 * @typedef {import('./speech-bubble.js').BubbleOptions} BubbleOptions
 * @typedef {import('./poses.js').PoseName} PoseName
 * @typedef {import('../audio/sound-board.js').SoundName} SoundName
 *
 * @typedef {object} ControllerDependencies
 * @property {Character} character
 * @property {OfficePorts} ports
 * @property {Clock} clock
 * @property {Scheduler} scheduler
 * @property {Translator} translator
 * @property {(message: string, error: unknown) => void} logError
 */

const GRUMBLE_MS = 1800

/**
 * The brain of one agent on screen: turns its live snapshot into where to walk, how to look and what to say,
 * and runs its scripted scenes (arrival, delivery, spilled coffee).
 * @implements {GossipParticipant}
 * @example
 * const controller = new AgentController({ character, ports, clock, scheduler, translator, logError })
 * controller.arrive('main')
 * controller.update(clock.now()) // every frame
 */
export class AgentController {
  leaving = false
  /** On its way in for its task envelope: its parent should stay at the desk to hand it over. */
  arriving = false
  /** @type {TargetName | null} */
  #currentTarget = null
  #arrived = false
  #thinkingSince = 0
  #wasThinking = false
  #clock
  #ports
  #translator
  #walker
  #scripts
  #reasoner
  #coffee
  #temper = new Temper()
  #scriptContext

  /** @param {ControllerDependencies} dependencies */
  constructor({ character, ports, clock, scheduler, translator, logError }) {
    this.character = character
    this.#clock = clock
    this.#ports = ports
    this.#translator = translator
    this.#walker = new Walker(character, ports.planRoute)
    this.#scripts = new ScriptQueue({ onStart: () => this.#interruptFreeActivity(), logError })
    this.#reasoner = new CoffeeReasoner(translator)
    this.#coffee = new CoffeeBreak({ character, ports, clock, translator })
    const actor = {
      character,
      walkTo: this.#walker.walkTo.bind(this.#walker),
      settleAtDesk: () => this.#settleAt('desk'),
    }
    this.#scriptContext = /** @type {ScriptContext} */ ({ actor, ports, scheduler, translator })
  }

  get id() {
    return this.character.id
  }

  get snapshot() {
    return this.character.snapshot
  }

  get position() {
    return this.character.position
  }

  /** In a scripted scene or on the way out: the office is not idle. */
  get isBusy() {
    return this.#scripts.isRunning || this.leaving
  }

  get isSeated() {
    return this.#arrived && this.#currentTarget === 'desk' && !this.#scripts.isRunning
  }

  get isAtCoffee() {
    return this.#coffee.atCoffee
  }

  get canGossip() {
    const { character } = this
    return (
      this.isAtCoffee && !this.isBusy && !character.isLocked && !character.carried && !this.#coffee.isChatting
    )
  }

  /**
   * @param {GossipParticipant} partner
   * @param {number} ms
   */
  chatWith(partner, ms) {
    this.#coffee.chatWith(partner.position, ms)
  }

  /**
   * @param {string} text
   * @param {BubbleOptions} options
   */
  say(text, options) {
    this.character.bubble.show(text, options)
    this.#ports.playSound('gossip')
  }

  /** @param {number} now */
  update(now) {
    this.character.seat = this.#ports.seatOf(this.id)
    this.#walker.update(now)
    if (this.isBusy || this.character.isLocked) return
    this.#updateFreeActivity()
  }

  /** Puts the agent straight at its desk, for agents restored from a snapshot. */
  sitDown() {
    const [x, z] = this.#ports.seatOf(this.id)
    this.character.placeAt(x, z)
    this.character.face(SEATED_FACING)
    this.character.setPose('seated')
    this.#settleAt('desk')
  }

  /** @param {string} parentId */
  arrive(parentId) {
    this.arriving = true
    return this.#scripts.enqueue(async () => {
      try {
        await arrivalScript(this.#scriptContext, parentId)
      } finally {
        this.arriving = false
      }
    })
  }

  /**
   * @param {string} parentId
   * @param {boolean} succeeded
   */
  depart(parentId, succeeded) {
    if (this.leaving) return
    this.leaving = true
    void this.#scripts.enqueue(() => departureScript(this.#scriptContext, parentId, succeeded))
  }

  #updateFreeActivity() {
    const now = this.#clock.now()
    const visit = this.#coffee.visit
    const coffeeToolId = visit?.reason === 'compiling' ? visit.toolUseId : null
    if (this.#coffee.commandFailedHere(this.snapshot)) {
      void this.#scripts.enqueue(() => spillScript(this.#scriptContext))
      return
    }
    if (this.#loseTemper(now, coffeeToolId)) return
    this.#trackThinking(now)
    const coffeeVisit = this.#decideCoffee(now)
    this.#follow(planActivity({ ...this.#activityInput(now), coffeeVisit }))
  }

  /**
   * @param {number} now
   * @param {string | null} coffeeToolId
   * @returns {boolean} Whether a desk punch took over.
   */
  #loseTemper(now, coffeeToolId) {
    const outburst = this.#temper.react({
      snapshot: this.snapshot,
      now,
      atCoffee: this.isAtCoffee,
      coffeeToolId,
    })
    if (outburst === 'punch') {
      void this.#scripts.enqueue(() => deskPunchScript(this.#scriptContext))
      return true
    }
    if (outburst === 'grumble') {
      this.character.bubble.show(this.#translator.t('bubble.grumble'), {
        durationMs: GRUMBLE_MS,
        priority: true,
      })
      this.#ports.playSound('grumble')
    }
    return false
  }

  /**
   * @param {number} now
   * @returns {import('../coffee/coffee-rules.js').CoffeeVisit | null}
   */
  #decideCoffee(now) {
    const visit = this.#reasoner.reasonFor({
      currentTool: newestActiveTool(this.snapshot),
      now,
      thinking: this.snapshot.thinking,
      childCount: this.#ports.childCountOf(this.id),
      arrivingChildCount: this.#ports.arrivingChildCountOf(this.id),
      atCoffee: this.#currentTarget === 'coffee',
    })
    // The visit is kept after the reason goes away so the outcome of its command can still be checked.
    if (visit) this.#coffee.visit = visit
    return visit
  }

  /**
   * @param {number} now
   * @returns {Omit<import('./activity-planner.js').ActivityInput, 'coffeeVisit'>}
   */
  #activityInput(now) {
    return {
      snapshot: this.snapshot,
      now,
      currentTarget: this.#currentTarget,
      thinkingSince: this.#thinkingSince,
      officeIdle: this.#ports.isIdle(),
      translator: this.#translator,
    }
  }

  /** @param {import('./activity-planner.js').ActivityPlan} plan */
  #follow(plan) {
    if (plan.bubble) this.character.bubble.show(plan.bubble)
    else this.character.bubble.hide()
    if (plan.target !== this.#currentTarget) this.#headTo(plan.target)
    else if (this.#arrived && plan.target === 'desk' && !this.character.isOnSeat) this.#headTo('desk')
    if (this.#arrived) this.#faceWhileThere(plan.target)
    this.character.setPose(this.#arrived ? plan.pose : 'standing')
    const ongoing = this.#arrived ? ONGOING_SOUNDS[plan.pose] : undefined
    if (ongoing) this.#ports.playSound(ongoing)
  }

  /** @param {number} now */
  #trackThinking(now) {
    if (this.snapshot.thinking && !this.#wasThinking) this.#thinkingSince = now
    this.#wasThinking = this.snapshot.thinking
  }

  /** @param {TargetName} target */
  #headTo(target) {
    if (this.#currentTarget === 'coffee') this.#coffee.leave()
    if (target === 'desk' || target === 'coffee') this.#ports.releaseStationSpot(this.id)
    this.#currentTarget = target
    this.#arrived = false
    const point = this.#pointOf(target)
    void this.#walker.walkTo(() => point).then(() => this.#onArrived(target))
  }

  /** @param {TargetName} target */
  #onArrived(target) {
    if (this.#currentTarget !== target) return
    this.#arrived = true
    this.character.face(facingAt(target))
    if (target === 'coffee') this.#coffee.arrive()
    const sound = ARRIVAL_SOUNDS[target]
    if (sound) this.#ports.playSound(sound)
  }

  /** @param {TargetName} target */
  #faceWhileThere(target) {
    const partner = target === 'coffee' ? this.#coffee.currentPartner : null
    if (partner) this.character.lookAt(partner.x, partner.z)
    else this.character.face(facingAt(target))
  }

  /**
   * @param {TargetName} target
   * @returns {Point2}
   */
  #pointOf(target) {
    if (target === 'desk') return this.#ports.seatOf(this.id)
    if (target === 'coffee') return this.#ports.occupyCoffeeSpot(this.id)
    return this.#ports.occupyStationSpot(this.id, target)
  }

  /** @param {TargetName} target */
  #settleAt(target) {
    this.#currentTarget = target
    this.#arrived = true
  }

  // A script takes over: leave the coffee machine (closing the break) and forget the current target.
  #interruptFreeActivity() {
    if (this.#currentTarget === 'coffee') this.#coffee.leave()
    this.#ports.releaseStationSpot(this.id)
    this.#currentTarget = null
  }
}

/**
 * What an agent's arrival at a place sounds like.
 * @type {Readonly<Partial<Record<TargetName, SoundName>>>}
 */
const ARRIVAL_SOUNDS = Object.freeze({
  bookshelf: 'pageFlip',
  whiteboard: 'marker',
  rack: 'serverBeep',
  globe: 'globeSpin',
  phone: 'phoneRing',
  coffee: 'brew',
})

/**
 * Sounds that keep going while an agent holds a pose; the sound board spaces the repeats out.
 * @type {Readonly<Partial<Record<PoseName, SoundName>>>}
 */
const ONGOING_SOUNDS = Object.freeze({ typing: 'typing', napping: 'snore', writingOnBoard: 'marker' })

/**
 * @param {TargetName} target
 * @returns {number}
 */
function facingAt(target) {
  if (target === 'desk') return SEATED_FACING
  if (target === 'coffee') return COFFEE_FACING
  return STATIONS[target].facing
}
