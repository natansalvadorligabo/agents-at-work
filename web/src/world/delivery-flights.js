import { Vector3 } from '../lib/three.js'
import { envelopeModel } from '../models/props.js'
import { createVoxelMesh } from '../voxel/voxel-mesh.js'

/**
 * @typedef {import('../lib/three.js').Scene} Scene
 * @typedef {import('../lib/three.js').Mesh} Mesh
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../models/props.js').DeliveryKind} DeliveryKind
 * @typedef {import('../agents/character.js').Character} Character
 *
 * @typedef {object} Flight
 * @property {Mesh} mesh
 * @property {Character} recipient
 * @property {Vector3} origin
 * @property {number} startedAt
 * @property {DeliveryKind} kind
 * @property {() => void} land
 */

const FLIGHT_MS = 750
const ARC_HEIGHT = 0.55
const ENVELOPE_SCALE = 1.6

/**
 * Envelopes flying in an arc from one agent's hand to another's.
 * @example
 * await flights.launch(parent, child, 'task') // the child now carries the envelope
 */
export class DeliveryFlights {
  /** @type {Flight[]} */
  #flights = []
  #scene
  #clock
  #landing = new Vector3()

  /**
   * @param {Scene} scene
   * @param {Clock} clock
   */
  constructor(scene, clock) {
    this.#scene = scene
    this.#clock = clock
  }

  /**
   * Takes the envelope from the sender's hand and flies it to the recipient, who then carries it.
   * @param {Character} sender
   * @param {Character} recipient
   * @param {DeliveryKind} kind
   * @returns {Promise<void>} Resolves on landing.
   */
  launch(sender, recipient, kind) {
    sender.dropCarried()
    const mesh = createVoxelMesh(envelopeModel(kind))
    mesh.scale.setScalar(ENVELOPE_SCALE)
    const origin = sender.handWorldPosition()
    mesh.position.copy(origin)
    this.#scene.add(mesh)
    return new Promise(land => {
      this.#flights.push({ mesh, recipient, origin, startedAt: this.#clock.now(), kind, land })
    })
  }

  /** @param {number} now */
  update(now) {
    this.#flights = this.#flights.filter(flight => this.#advance(flight, now))
  }

  clear() {
    for (const flight of this.#flights) flight.mesh.removeFromParent()
    this.#flights = []
  }

  /**
   * @param {Flight} flight
   * @param {number} now
   * @returns {boolean} Whether the flight is still in the air.
   */
  #advance(flight, now) {
    const progress = Math.min(1, (now - flight.startedAt) / FLIGHT_MS)
    flight.recipient.handWorldPosition(this.#landing)
    flight.mesh.position.lerpVectors(flight.origin, this.#landing, progress)
    flight.mesh.position.y += Math.sin(progress * Math.PI) * ARC_HEIGHT
    flight.mesh.rotation.y = progress * Math.PI * 2
    if (progress < 1) return true
    flight.mesh.removeFromParent()
    flight.recipient.carry(flight.kind)
    flight.land()
    return false
  }
}
