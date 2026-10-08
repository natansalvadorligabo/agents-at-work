import { coffeePuddleModel } from '../models/props.js'
import { createVoxelMesh } from '../voxel/voxel-mesh.js'

/**
 * @typedef {import('../lib/three.js').Scene} Scene
 * @typedef {import('../lib/three.js').Mesh} Mesh
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../core/clock.js').RandomSource} RandomSource
 * @typedef {{ mesh: Mesh, spilledAt: number }} Puddle
 */

const PUDDLE_LIFETIME_MS = 12000
const SPREAD_MS = 250
const DRY_UP_MS = 1500

/**
 * Scales a puddle in quickly when spilled and out slowly as it dries.
 * @param {number} age
 * @returns {number} Scale in (0, 1]; 0 once the puddle is gone.
 * @example puddleScale(125) // 0.5
 */
export function puddleScale(age) {
  const remaining = PUDDLE_LIFETIME_MS - age
  if (remaining <= 0) return 0
  return Math.max(0.001, Math.min(1, age / SPREAD_MS, remaining / DRY_UP_MS))
}

/**
 * Coffee puddles left on the floor by agents whose command failed mid-break. They dry up on their own.
 * @example puddles.spill(1.2, 4.5)
 */
export class CoffeePuddles {
  /** @type {Puddle[]} */
  #puddles = []
  #scene
  #clock
  #random

  /** @param {{ scene: Scene, clock: Clock, random: RandomSource }} dependencies */
  constructor({ scene, clock, random }) {
    this.#scene = scene
    this.#clock = clock
    this.#random = random
  }

  get count() {
    return this.#puddles.length
  }

  /**
   * @param {number} x
   * @param {number} z
   */
  spill(x, z) {
    const mesh = createVoxelMesh(coffeePuddleModel())
    mesh.castShadow = false
    mesh.position.set(x, 0.002, z)
    mesh.rotation.y = this.#random() * Math.PI
    mesh.scale.setScalar(0.001)
    this.#scene.add(mesh)
    this.#puddles.push({ mesh, spilledAt: this.#clock.now() })
  }

  /** @param {number} now */
  update(now) {
    this.#puddles = this.#puddles.filter(puddle => {
      const scale = puddleScale(now - puddle.spilledAt)
      if (scale === 0) puddle.mesh.removeFromParent()
      else puddle.mesh.scale.setScalar(scale)
      return scale > 0
    })
  }
}
