import { DESK_PART } from './furniture-placement.js'

/**
 * @typedef {import('../lib/three.js').Object3D} Object3D
 * @typedef {{ desk: Object3D, monitor: Object3D | null, monitorBaseY: number, startedAt: number }} Jolt
 */

const JOLT_MS = 750
const DESK_BOUNCE = 0.035
const DESK_ROCK = 0.035
const MONITOR_HOP = 0.05
const MONITOR_WOBBLE = 0.35

/**
 * How strong a jolt still is, fading out: 1 right after the punch, 0 once it is over.
 * @param {number} age Milliseconds since the punch.
 * @returns {number}
 * @example joltStrength(0) // 1
 */
export function joltStrength(age) {
  return Math.max(0, 1 - age / JOLT_MS)
}

/**
 * Shakes a desk after someone punched it: the desk bounces and rocks, the monitor hops and wobbles back
 * and forth on its stand, all dying down within a second.
 * @example
 * jolts.jolt(deskSet, clock.now())
 * jolts.update(clock.now()) // every frame
 */
export class DeskJolts {
  /** @type {Jolt[]} */
  #jolts = []

  /**
   * @param {Object3D} deskSet A group made by createDeskSet.
   * @param {number} now
   */
  jolt(deskSet, now) {
    const desk = deskSet.getObjectByName(DESK_PART.desk)
    if (!desk) return
    const running = this.#jolts.find(jolt => jolt.desk === desk)
    if (running) {
      running.startedAt = now
      return
    }
    const monitor = desk.getObjectByName(DESK_PART.monitor) ?? null
    this.#jolts.push({ desk, monitor, monitorBaseY: monitor?.position.y ?? 0, startedAt: now })
  }

  /** @param {number} now */
  update(now) {
    this.#jolts = this.#jolts.filter(jolt => this.#shake(jolt, now))
  }

  /**
   * @param {Jolt} jolt
   * @param {number} now
   * @returns {boolean} Whether it is still shaking; a finished jolt leaves everything back at rest.
   */
  #shake({ desk, monitor, monitorBaseY, startedAt }, now) {
    const age = now - startedAt
    const strength = joltStrength(age)
    const t = age / 1000
    desk.position.y = Math.abs(Math.sin(t * 38)) * DESK_BOUNCE * strength
    desk.rotation.z = Math.sin(t * 45) * DESK_ROCK * strength
    if (monitor) {
      monitor.position.y = monitorBaseY + Math.abs(Math.sin(t * 22)) * MONITOR_HOP * strength
      monitor.rotation.x = Math.sin(t * 26) * MONITOR_WOBBLE * strength
    }
    return strength > 0
  }
}
