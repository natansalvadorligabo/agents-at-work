import { Color, DirectionalLight, HemisphereLight } from '../lib/three.js'
import { ROOM_DEPTH } from './layout.js'

/**
 * @typedef {import('../lib/three.js').Scene} Scene
 * @typedef {'working' | 'idle' | 'ended'} OfficeMood
 * @typedef {{ ambient: number, sun: number, background: number }} LightingPreset
 */

/** @type {Record<OfficeMood, LightingPreset>} */
const PRESETS = {
  working: { ambient: 1.6, sun: 2.1, background: 0x1d2230 },
  idle: { ambient: 0.28, sun: 0.1, background: 0x0c0f17 },
  ended: { ambient: 0.18, sun: 0.05, background: 0x07090e },
}
const TRANSITION_RATE = 1.8
const SHADOW_MAP_SIZE = 2048

/**
 * Sky light plus a shadow-casting sun. The lights dim when the office goes idle and almost go out when the
 * session ends.
 * @example
 * const lighting = new OfficeLighting(scene)
 * lighting.update(seconds, 'idle')
 */
export class OfficeLighting {
  #scene
  #targetBackground = new Color()

  /** @param {Scene} scene */
  constructor(scene) {
    this.#scene = scene
    scene.background = new Color(PRESETS.working.background)
    this.ambient = new HemisphereLight(0xfff4e0, 0x3a3f55, PRESETS.working.ambient)
    this.sun = new DirectionalLight(0xffffff, PRESETS.working.sun)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
    this.sun.shadow.bias = -0.0008
    this.sun.shadow.normalBias = 0.02
    scene.add(this.ambient, this.sun, this.sun.target)
  }

  /**
   * Keeps the whole room inside the sun's shadow camera.
   * @param {number} roomWidth
   */
  fitToRoom(roomWidth) {
    const half = Math.max(roomWidth, ROOM_DEPTH) * 0.85
    Object.assign(this.sun.shadow.camera, {
      left: -half,
      right: half,
      top: half,
      bottom: -half,
      near: 1,
      far: 80,
    })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.sun.target.position.set(roomWidth / 2, 0, ROOM_DEPTH / 2)
    this.sun.position.set(roomWidth / 2 + 12, 24, ROOM_DEPTH / 2 + 14)
  }

  /**
   * @param {number} seconds
   * @param {OfficeMood} mood
   */
  update(seconds, mood) {
    const preset = PRESETS[mood]
    const blend = 1 - Math.exp(-seconds * TRANSITION_RATE)
    this.ambient.intensity += (preset.ambient - this.ambient.intensity) * blend
    this.sun.intensity += (preset.sun - this.sun.intensity) * blend
    if (this.#scene.background instanceof Color)
      this.#scene.background.lerp(this.#targetBackground.setHex(preset.background), blend)
  }
}
