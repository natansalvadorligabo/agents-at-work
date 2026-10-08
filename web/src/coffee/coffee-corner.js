import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from '../lib/three.js'
import {
  COFFEE_BAR_PIVOT,
  JUG_SPOUT_VOXEL,
  coffeeBarModel,
  coffeeMachineLightModel,
} from '../models/coffee-bar.js'
import { VOXEL_SIZE, createGlowingVoxelMesh, createVoxelMesh } from '../voxel/voxel-mesh.js'
import { COFFEE_BAR_POSITION } from '../world/layout.js'

/**
 * @typedef {import('../lib/three.js').Scene} Scene
 * @typedef {import('../lib/three.js').Object3D} Object3D
 * @typedef {{ mesh: Mesh<BoxGeometry, MeshBasicMaterial>, phase: number }} SteamPuff
 */

const STEAM_PUFFS = 4
const STEAM_CYCLE_MS = 2200
const STEAM_RISE = 0.55
const LIGHT_BLINK_MS = 300
const IDLE_STEAM_OPACITY = 0.35
const BUSY_STEAM_OPACITY = 0.85

/**
 * The coffee counter against the back wall: its power light blinks and the jug steams harder while someone
 * is on a break. Clicking it opens the coffee ranking.
 * @example
 * const corner = new CoffeeCorner(scene)
 * corner.animate(clock.now(), someoneAtCoffee)
 */
export class CoffeeCorner {
  /** @type {SteamPuff[]} */
  #steam = []
  #spout

  /** @param {Scene} scene */
  constructor(scene) {
    const pivot = /** @type {[number, number, number]} */ ([...COFFEE_BAR_PIVOT])
    /** The object picked by clicks. */
    this.counter = createVoxelMesh(coffeeBarModel(), pivot)
    this.counter.position.set(COFFEE_BAR_POSITION.x, 0, COFFEE_BAR_POSITION.z)
    this.light = createGlowingVoxelMesh(coffeeMachineLightModel(), pivot)
    this.counter.add(this.light)
    // In the counter's own (rotated) frame, so the steam follows the jug.
    const [x, y, z] = JUG_SPOUT_VOXEL
    this.#spout = new Vector3((x - pivot[0]) * VOXEL_SIZE, y * VOXEL_SIZE, (z - pivot[2]) * VOXEL_SIZE)
    for (let i = 0; i < STEAM_PUFFS; i++) this.#steam.push(this.#createPuff(i / STEAM_PUFFS))
    scene.add(this.counter)
  }

  /**
   * @param {Object3D} object
   * @returns {boolean} Whether a clicked object belongs to the coffee counter.
   */
  contains(object) {
    for (let current = /** @type {Object3D | null} */ (object); current; current = current.parent) {
      if (current === this.counter) return true
    }
    return false
  }

  /**
   * @param {number} now
   * @param {boolean} someoneAtCoffee
   */
  animate(now, someoneAtCoffee) {
    this.light.visible = !someoneAtCoffee || Math.floor(now / LIGHT_BLINK_MS) % 2 === 0
    const maxOpacity = someoneAtCoffee ? BUSY_STEAM_OPACITY : IDLE_STEAM_OPACITY
    for (const puff of this.#steam) this.#animatePuff(puff, now, maxOpacity)
  }

  /**
   * @param {number} phase
   * @returns {SteamPuff}
   */
  #createPuff(phase) {
    const size = 1.4 * VOXEL_SIZE
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const mesh = new Mesh(new BoxGeometry(size, size, size), material)
    this.counter.add(mesh)
    return { mesh, phase }
  }

  /**
   * @param {SteamPuff} puff
   * @param {number} now
   * @param {number} maxOpacity
   */
  #animatePuff({ mesh, phase }, now, maxOpacity) {
    const progress = (now / STEAM_CYCLE_MS + phase) % 1
    mesh.position.copy(this.#spout)
    mesh.position.y += progress * STEAM_RISE
    mesh.position.x += Math.sin(progress * 9 + phase * 6) * 0.04
    mesh.material.opacity = Math.sin(progress * Math.PI) * maxOpacity
    mesh.scale.setScalar(1 + progress * 1.5)
  }
}
