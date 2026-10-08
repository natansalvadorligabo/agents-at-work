import { createAgentSnapshot } from '#shared/agent-snapshot.js'
import { AgentStatus, MAIN_AGENT_ID } from '#shared/protocol.js'
import { AgentController } from '../agents/agent-controller.js'
import { agentDisplayName } from '../agents/agent-names.js'
import { Character } from '../agents/character.js'
import { CoffeeCorner } from '../coffee/coffee-corner.js'
import { CoffeePuddles } from '../coffee/coffee-puddles.js'
import { CoffeeSpots } from '../coffee/coffee-spots.js'
import { CoffeeStats } from '../coffee/coffee-stats.js'
import { GossipDirector } from '../coffee/gossip.js'
import { pickRandom } from '../core/clock.js'
import { Raycaster, Scene, Vector2 } from '../lib/three.js'
import { AgentRoster } from './agent-roster.js'
import { CameraRig } from './camera-rig.js'
import { separateCrowd } from './crowd.js'
import { DeliveryFlights } from './delivery-flights.js'
import { DeskSlots } from './desk-slots.js'
import { OfficeDoor, RackLeds, placeFixedFurniture } from './furniture-placement.js'
import { placeLabels } from './label-placement.js'
import {
  DOOR_OUTSIDE,
  MAIN_DESK,
  MIN_ROOM_WIDTH,
  ROOM_DEPTH,
  WALL_HEIGHT,
  blockedTiles,
  requiredRoomWidth,
  seatAt,
} from './layout.js'
import { OfficeLighting } from './lighting.js'
import { planRoute } from './navigation.js'
import { PathGrid } from './path-grid.js'
import { RoomShell } from './room-shell.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('../agents/speech-bubble.js').LabelLayer} LabelLayer
 * @typedef {import('../agents/office-ports.js').OfficePorts} OfficePorts
 * @typedef {import('../coffee/gossip.js').GossipContext} GossipContext
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../core/clock.js').Scheduler} Scheduler
 * @typedef {import('../core/clock.js').RandomSource} RandomSource
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../lib/three.js').Camera} Camera
 * @typedef {import('../lib/three.js').Object3D} Object3D
 * @typedef {import('./lighting.js').OfficeMood} OfficeMood
 *
 * The slice of `WebGLRenderer` the office draws with; tests pass a fake.
 * @typedef {object} SceneRenderer
 * @property {(scene: Scene, camera: Camera) => void} render
 * @property {(width: number, height: number) => void} setSize
 *
 * @typedef {object} OfficeDependencies
 * @property {SceneRenderer} renderer
 * @property {LabelLayer} labels
 * @property {Clock} clock
 * @property {Scheduler} scheduler
 * @property {RandomSource} random
 * @property {Translator} translator
 * @property {number} idleMs Quiet time after which everyone naps and the lights dim.
 * @property {(message: string, error: unknown) => void} logError
 *
 * @typedef {{ kind: 'agent', agentId: string } | { kind: 'coffee' } | { kind: 'none' }} PickResult
 */

const MAX_FRAME_SECONDS = 0.1

/**
 * The whole office scene: room, furniture, coffee corner and every agent, plus the frame loop that moves
 * them. It is also the OfficePorts each AgentController talks to.
 * @example
 * const office = new Office({ renderer, labels, clock, scheduler, random, translator, idleMs: 45000, logError })
 * office.addAgent(snapshot)
 * renderer.setAnimationLoop(() => office.frame())
 */
export class Office {
  #scene = new Scene()
  #roster = new AgentRoster()
  #grid = new PathGrid(MIN_ROOM_WIDTH, ROOM_DEPTH)
  #coffeeSpots = new CoffeeSpots()
  #raycaster = new Raycaster()
  #viewport = { width: 1, height: 1 }
  #ended = false
  #deps
  #lastActivityAt
  #lastFrameAt

  /** @param {OfficeDependencies} dependencies */
  constructor(dependencies) {
    this.#deps = dependencies
    const { clock, scheduler, random, translator } = dependencies
    this.#lastActivityAt = this.#lastFrameAt = clock.now()
    this.cameraRig = new CameraRig(clock)
    this.#lighting = new OfficeLighting(this.#scene)
    this.#room = new RoomShell(this.#scene)
    this.#scenery = this.#buildScenery()
    this.#desks = new DeskSlots(this.#scene, () => this.#refreshFloorPlan(false))
    this.#coffeeStats = new CoffeeStats(clock)
    this.#gossip = new GossipDirector({ clock, scheduler, random, translator })
    this.#ports = this.#createPorts()
    this.#refreshFloorPlan(true)
    translator.onChange(() => this.#roster.characters().forEach(character => character.refreshNameplate()))
    this.addMainAgent()
  }

  #lighting
  #room
  #scenery
  #desks
  #coffeeStats
  #gossip
  #ports

  /** @returns {{ width: number, depth: number, height: number }} */
  get roomBounds() {
    return { width: this.#grid.width, depth: ROOM_DEPTH, height: WALL_HEIGHT }
  }

  /** @param {number} width @param {number} height */
  resize(width, height) {
    this.#viewport = { width, height }
    this.#deps.renderer.setSize(width, height)
    this.cameraRig.setViewport(width, height)
  }

  /** @param {string} agentId */
  hasAgent(agentId) {
    return this.#roster.has(agentId)
  }

  addMainAgent() {
    return this.addAgent(createAgentSnapshot(MAIN_AGENT_ID, {}, this.#deps.clock.now()), { restored: true })
  }

  /**
   * Brings an agent into the office: through the door to meet its parent, or straight to its desk when it
   * was already running before the page loaded (`restored`).
   * @param {AgentSnapshot} snapshot
   * @param {{ restored?: boolean }} [options]
   * @returns {Character}
   */
  addAgent(snapshot, { restored = false } = {}) {
    this.#touch()
    const existing = this.#roster.get(snapshot.id)
    if (existing) return existing.character
    if (snapshot.id !== MAIN_AGENT_ID) this.#desks.occupy(snapshot.id)
    const { labels, clock, scheduler, random, translator, logError } = this.#deps
    const character = new Character({ snapshot, labels, clock, random, translator })
    const controller = new AgentController({
      character,
      ports: this.#ports,
      clock,
      scheduler,
      translator,
      logError,
    })
    this.#roster.add({ character, controller })
    this.#scene.add(character.root)
    character.appear()
    if (restored) controller.sitDown()
    else this.#walkIn(character, controller, snapshot)
    return character
  }

  /**
   * @param {AgentSnapshot} snapshot
   * @returns {Character | undefined}
   */
  updateAgent(snapshot) {
    this.#touch()
    const character = this.#roster.get(snapshot.id)?.character
    character?.updateSnapshot(snapshot)
    return character
  }

  /**
   * A subagent finished: it delivers its result (or failure) and leaves.
   * @param {AgentSnapshot} snapshot
   */
  finishAgent(snapshot) {
    this.#touch()
    const entry = this.#roster.get(snapshot.id)
    if (!entry) return
    entry.character.updateSnapshot(snapshot)
    entry.controller.depart(snapshot.parentId ?? MAIN_AGENT_ID, snapshot.status === AgentStatus.DONE)
  }

  /** Empties the office before rebuilding it from a fresh snapshot. */
  clearAll() {
    for (const agentId of this.#roster.ids()) this.#roster.remove(agentId)
    this.#desks.clear()
    this.#scenery.flights.clear()
    this.#coffeeSpots.clear()
    this.#coffeeStats.abandonOpenBreaks()
    this.#refreshFloorPlan(true)
  }

  /** @param {boolean} ended */
  setSessionEnded(ended) {
    this.#ended = ended
  }

  /** @param {string} agentId */
  coffeeStatFor(agentId) {
    return this.#coffeeStats.statFor(agentId)
  }

  coffeeRanking() {
    return this.#coffeeStats.ranking()
  }

  /**
   * What is under a point of the viewport, in normalized device coordinates (-1..1, y up).
   * @param {number} x
   * @param {number} y
   * @returns {PickResult}
   */
  pick(x, y) {
    this.#raycaster.setFromCamera(new Vector2(x, y), this.cameraRig.camera)
    const targets = [
      ...this.#roster.characters().map(character => character.root),
      this.#scenery.coffeeCorner.counter,
    ]
    const [hit] = this.#raycaster.intersectObjects(targets, true)
    if (!hit) return { kind: 'none' }
    if (this.#scenery.coffeeCorner.contains(hit.object)) return { kind: 'coffee' }
    const agentId = characterIdOf(hit.object)
    return agentId ? { kind: 'agent', agentId } : { kind: 'none' }
  }

  /** Advances and draws one frame. */
  frame() {
    const now = this.#deps.clock.now()
    const seconds = Math.min(MAX_FRAME_SECONDS, (now - this.#lastFrameAt) / 1000)
    this.#lastFrameAt = now
    this.#updateAgents(now, seconds)
    this.#updateCoffee(now)
    this.#updateScenery(now, seconds)
    this.cameraRig.update(seconds, this.roomBounds)
    this.#deps.renderer.render(this.#scene, this.cameraRig.camera)
    placeLabels(this.#roster.characters(), this.cameraRig.camera, this.#viewport)
  }

  #buildScenery() {
    placeFixedFurniture(this.#scene)
    const { clock, random } = this.#deps
    return {
      rackLeds: new RackLeds(this.#scene),
      door: new OfficeDoor(this.#scene),
      coffeeCorner: new CoffeeCorner(this.#scene),
      puddles: new CoffeePuddles({ scene: this.#scene, clock, random }),
      flights: new DeliveryFlights(this.#scene, clock),
    }
  }

  /** @returns {OfficePorts} */
  #createPorts() {
    const [coffeeStats, desks, roster, scenery] = [
      this.#coffeeStats,
      this.#desks,
      this.#roster,
      this.#scenery,
    ]
    return {
      planRoute: (position, destination) => planRoute(this.#grid, position, destination),
      seatOf: agentId => (agentId === MAIN_AGENT_ID ? seatAt(MAIN_DESK) : desks.seatOf(agentId)),
      occupyCoffeeSpot: agentId => this.#coffeeSpots.occupy(agentId),
      releaseCoffeeSpot: agentId => this.#coffeeSpots.release(agentId),
      recordCoffeeArrival: agent => coffeeStats.arrive(agent),
      recordCoffeeDeparture: agentId => coffeeStats.leave(agentId),
      spillCoffee: (x, z) => scenery.puddles.spill(x, z),
      focusOn: (characters, ms) =>
        this.cameraRig.addFocus(() => characters.map(character => character.position), ms),
      deliver: (from, to, kind) => scenery.flights.launch(from, to, kind),
      parentCharacter: (parentId, childId) => roster.parentCharacter(parentId, childId),
      isAtCoffee: agentId => roster.get(agentId)?.controller.isAtCoffee ?? false,
      childCountOf: agentId => roster.childCountOf(agentId),
      removeAgent: agentId => this.#removeAgent(agentId),
      isIdle: () => this.#isIdle(),
    }
  }

  /** @returns {GossipContext} */
  get #gossipContext() {
    const { random, translator } = this.#deps
    return {
      nameSomeoneElse: excludedIds => {
        const others = this.#roster.characters().filter(character => !excludedIds.includes(character.id))
        return others.length > 0 ? agentDisplayName(pickRandom(others, random).snapshot, translator) : null
      },
      cupsOf: agentId => this.#coffeeStats.statFor(agentId).cups,
    }
  }

  /**
   * @param {Character} character
   * @param {AgentController} controller
   * @param {AgentSnapshot} snapshot
   */
  #walkIn(character, controller, snapshot) {
    character.placeAt(DOOR_OUTSIDE[0], DOOR_OUTSIDE[1])
    void controller.arrive(snapshot.parentId ?? MAIN_AGENT_ID)
  }

  /** @param {string} agentId */
  #removeAgent(agentId) {
    if (this.#roster.remove(agentId)) this.#desks.release(agentId)
  }

  /** @param {boolean} resized Forces a re-layout even when the width did not change. */
  #refreshFloorPlan(resized) {
    const slots = this.#desks.occupiedSlots()
    const width = requiredRoomWidth(slots)
    if (resized || width !== this.#grid.width) {
      this.#grid.resize(width, ROOM_DEPTH)
      this.#room.resize(width)
      this.#lighting.fitToRoom(width)
    }
    this.#grid.clearBlocks()
    for (const [x, z] of blockedTiles(slots)) this.#grid.block(x, z)
  }

  #touch() {
    this.#lastActivityAt = this.#deps.clock.now()
  }

  /** @returns {boolean} */
  #isIdle() {
    const main = this.#roster.get(MAIN_AGENT_ID)
    if (!main || main.character.snapshot.status !== AgentStatus.WAITING) return false
    if (this.#roster.controllers().some(controller => controller.isBusy)) return false
    return this.#deps.clock.now() - this.#lastActivityAt > this.#deps.idleMs
  }

  /** @returns {OfficeMood} */
  #mood() {
    if (this.#ended) return 'ended'
    return this.#isIdle() ? 'idle' : 'working'
  }

  /** @param {number} now @param {number} seconds */
  #updateAgents(now, seconds) {
    for (const controller of this.#roster.controllers()) controller.update(now)
    for (const character of this.#roster.characters()) character.update(seconds)
    const standing = this.#roster
      .controllers()
      .filter(controller => !controller.isSeated && !controller.character.isLocked)
    separateCrowd(
      standing.map(controller => controller.position),
      seconds,
    )
    this.#scenery.flights.update(now)
  }

  /** @param {number} now */
  #updateCoffee(now) {
    const controllers = this.#roster.controllers()
    this.#gossip.update(
      controllers.filter(controller => controller.canGossip),
      this.#gossipContext,
    )
    this.#scenery.puddles.update(now)
    this.#scenery.coffeeCorner.animate(
      now,
      controllers.some(controller => controller.isAtCoffee),
    )
  }

  /** @param {number} now @param {number} seconds */
  #updateScenery(now, seconds) {
    this.#desks.animate(seconds)
    this.#scenery.door.update(this.#roster.characters().map(character => character.position))
    this.#lighting.update(seconds, this.#mood())
    this.#scenery.rackLeds.update(now)
  }
}

/**
 * @param {Object3D} object
 * @returns {string | null}
 */
function characterIdOf(object) {
  for (let current = /** @type {Object3D | null} */ (object); current; current = current.parent) {
    const character = current.userData.character
    if (character instanceof Character) return character.id
  }
  return null
}
