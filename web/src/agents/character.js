import { MAIN_AGENT_TYPE } from '#shared/protocol.js'
import { Vector3 } from '../lib/three.js'
import { agentAppearance } from '../models/appearance.js'
import { envelopeModel } from '../models/props.js'
import { VOXEL_SIZE as V, createVoxelMesh } from '../voxel/voxel-mesh.js'
import { nameplateHtml } from './agent-names.js'
import { buildCharacterRig } from './character-rig.js'
import { advanceAlongPath, approach, lerpAngle } from './motion.js'
import { poseTargets } from './poses.js'
import { SpeechBubble } from './speech-bubble.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../core/clock.js').RandomSource} RandomSource
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../lib/three.js').Object3D} Object3D
 * @typedef {import('../models/props.js').DeliveryKind} DeliveryKind
 * @typedef {import('../world/layout.js').Point2} Point2
 * @typedef {import('./poses.js').PoseName} PoseName
 * @typedef {import('./speech-bubble.js').LabelLayer} LabelLayer
 * @typedef {import('./speech-bubble.js').OverlayLabel} OverlayLabel
 *
 * @typedef {object} CharacterDependencies
 * @property {AgentSnapshot} snapshot
 * @property {LabelLayer} labels
 * @property {Clock} clock
 * @property {RandomSource} random
 * @property {Translator} translator
 */

const WALK_SPEED = 2.4
const RUN_MULTIPLIER = 2.2
const SHAKE_AMPLITUDE = 0.6 * V
const TURN_SPEED = 10
const SCALE_SPEED = 9
const HEAD_HEIGHT = 22 * V
const JOINT_BLEND = 0.25
const LIFT_BLEND = 0.3
const VISIBLE_SCALE = 0.3
const VANISHED_SCALE = 0.02

/**
 * One agent on screen: its blocky body, where it walks, how it moves, what it holds and says.
 * Decisions about where to go live in AgentController; this class only carries them out.
 * @example
 * const character = new Character({ snapshot, labels, clock, random, translator })
 * scene.add(character.root)
 * character.followPath([[3, 4], [5, 4]])
 */
export class Character {
  /** @type {Vector3[]} */
  waypoints = []
  heading = 0
  targetHeading = 0
  /** @type {PoseName} */
  pose = 'standing'
  targetScale = 1
  lockedUntil = 0
  runningUntil = 0
  shakingUntil = 0
  /** @type {Object3D | null} */
  carried = null
  #clock
  #translator
  #animationTime

  /** @param {CharacterDependencies} dependencies */
  constructor({ snapshot, labels, clock, random, translator }) {
    this.id = snapshot.id
    this.snapshot = snapshot
    this.#clock = clock
    this.#translator = translator
    this.#animationTime = random() * 10
    this.rig = buildCharacterRig(agentAppearance(snapshot.id, snapshot.agentType))
    this.rig.root.userData.character = this
    this.rig.body.scale.setScalar(0.001)
    const isMain = snapshot.agentType === MAIN_AGENT_TYPE
    this.nameplate = labels.createLabel('nameplate', isMain)
    this.bubble = new SpeechBubble(labels.createLabel('bubble', isMain), clock)
    this.refreshNameplate()
  }

  get root() {
    return this.rig.root
  }

  /** The floor position (y stays 0). */
  get position() {
    return this.rig.root.position
  }

  get isWalking() {
    return this.waypoints.length > 0
  }

  get isLocked() {
    return this.#clock.now() < this.lockedUntil
  }

  get isVisible() {
    return this.rig.body.scale.x > VISIBLE_SCALE
  }

  get hasVanished() {
    return this.targetScale === 0 && this.rig.body.scale.x < VANISHED_SCALE
  }

  /** @param {AgentSnapshot} snapshot */
  updateSnapshot(snapshot) {
    this.snapshot = snapshot
    this.refreshNameplate()
  }

  refreshNameplate() {
    this.nameplate.setHtml(nameplateHtml(this.snapshot, this.#translator))
  }

  /** @param {number} x @param {number} z */
  placeAt(x, z) {
    this.position.set(x, 0, z)
    this.waypoints = []
  }

  appear() {
    this.targetScale = 1
  }

  disappear() {
    this.targetScale = 0
  }

  /**
   * Freezes the character in place (during a hand-off) and drops its current path.
   * @param {number} ms
   */
  lock(ms) {
    this.lockedUntil = Math.max(this.lockedUntil, this.#clock.now() + ms)
    this.waypoints = []
  }

  /** @param {readonly Point2[]} points */
  followPath(points) {
    this.waypoints = points.map(([x, z]) => new Vector3(x, 0, z))
  }

  /** @param {number} x @param {number} z */
  lookAt(x, z) {
    this.targetHeading = Math.atan2(x - this.position.x, z - this.position.z)
  }

  /** @param {number} angle */
  face(angle) {
    this.targetHeading = angle
  }

  /** @param {PoseName} pose */
  setPose(pose) {
    this.pose = pose
    this.#refreshHandItems()
  }

  /** @param {number} ms */
  run(ms) {
    this.runningUntil = this.#clock.now() + ms
  }

  /** @param {number} ms */
  shake(ms) {
    this.shakingUntil = this.#clock.now() + ms
  }

  /** @param {DeliveryKind} kind */
  carry(kind) {
    this.dropCarried()
    const model = envelopeModel(kind)
    const envelope = createVoxelMesh(model)
    envelope.rotation.x = Math.PI / 2
    envelope.position.z = 1.5 * V
    this.rig.rightHand.add(envelope)
    this.carried = envelope
    this.#refreshHandItems()
  }

  dropCarried() {
    if (!this.carried) return
    this.rig.rightHand.remove(this.carried)
    this.carried = null
    this.#refreshHandItems()
  }

  /**
   * @param {Vector3} [target]
   * @returns {Vector3}
   */
  handWorldPosition(target = new Vector3()) {
    return this.rig.rightHand.getWorldPosition(target)
  }

  /**
   * The point right above the head, where the nameplate and bubble anchor.
   * @param {Vector3} [target]
   * @returns {Vector3}
   */
  headTop(target = new Vector3()) {
    const body = this.rig.body
    return target.set(
      this.position.x,
      this.position.y + HEAD_HEIGHT * body.scale.y + body.position.y,
      this.position.z,
    )
  }

  /** @param {number} seconds Time since the previous frame. */
  update(seconds) {
    this.#animationTime += seconds
    this.#walk(seconds)
    this.heading = lerpAngle(this.heading, this.targetHeading, Math.min(1, seconds * TURN_SPEED))
    this.rig.root.rotation.y = this.heading
    const scale = approach(this.rig.body.scale.x, this.targetScale, Math.min(1, seconds * SCALE_SPEED))
    this.rig.body.scale.setScalar(Math.max(0.001, scale))
    this.#applyPose()
    this.#applyShake()
    this.bubble.update()
  }

  dispose() {
    this.nameplate.remove()
    this.bubble.dispose()
    this.rig.root.removeFromParent()
  }

  /** @param {number} seconds */
  #walk(seconds) {
    const running = this.#clock.now() < this.runningUntil
    const distance = WALK_SPEED * (running ? RUN_MULTIPLIER : 1) * seconds
    const heading = advanceAlongPath(this.position, this.waypoints, distance)
    if (heading !== null) this.targetHeading = heading
  }

  // The mug shows only while drinking coffee with free hands; the type's prop hides behind anything held.
  #refreshHandItems() {
    const holdingMug = this.pose === 'drinkingCoffee' && !this.carried
    this.rig.mug.visible = holdingMug
    if (this.rig.typeItem) this.rig.typeItem.visible = !this.carried && !holdingMug
  }

  #applyPose() {
    const pose = this.isWalking ? 'walking' : this.pose
    const target = poseTargets(pose, {
      time: this.#animationTime,
      carrying: Boolean(this.carried),
      phase: this.id.length,
    })
    const { leftLeg, rightLeg, leftArm, rightArm, head, body } = this.rig
    leftLeg.rotation.x = approach(leftLeg.rotation.x, target.leftLeg, JOINT_BLEND)
    rightLeg.rotation.x = approach(rightLeg.rotation.x, target.rightLeg, JOINT_BLEND)
    leftArm.rotation.x = approach(leftArm.rotation.x, target.leftArm, JOINT_BLEND)
    rightArm.rotation.x = approach(rightArm.rotation.x, target.rightArm, JOINT_BLEND)
    rightArm.rotation.z = approach(rightArm.rotation.z, target.rightArmSpread, JOINT_BLEND)
    head.rotation.x = approach(head.rotation.x, target.headPitch, JOINT_BLEND)
    head.rotation.z = approach(head.rotation.z, target.headRoll, JOINT_BLEND)
    body.position.y = approach(body.position.y, target.bodyLift, LIFT_BLEND)
  }

  // Jitter after too many coffees; deterministic per frame so it needs no random source.
  #applyShake() {
    const shaking = this.#clock.now() < this.shakingUntil
    const t = this.#animationTime * 60
    this.rig.body.position.x = shaking ? Math.sin(t * 1.7) * SHAKE_AMPLITUDE : 0
    this.rig.body.position.z = shaking ? Math.cos(t * 2.3) * SHAKE_AMPLITUDE : 0
  }
}
