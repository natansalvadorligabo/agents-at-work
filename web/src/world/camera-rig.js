import { MathUtils, OrthographicCamera, Vector3 } from '../lib/three.js'

/**
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {{ width: number, depth: number, height: number }} RoomBounds
 * @typedef {{ points: () => Vector3[], until: number }} Focus
 * @typedef {{ center: Vector3, halfHeight: number }} Framing
 * @typedef {{ forward: Vector3, right: Vector3, up: Vector3 }} CameraAxes
 */

const DEFAULT_YAW = Math.PI / 4
const DEFAULT_PITCH = 0.62
const MIN_PITCH = 0.3
const MAX_PITCH = 1.25
const CAMERA_DISTANCE = 60
const ROOM_MARGIN = 1.12
const FOCUS_MARGIN = 1.25
const MIN_FOCUS_HALF_HEIGHT = 2.8
const MIN_ZOOM_HALF_HEIGHT = 1.2
const MAX_ZOOM_HALF_HEIGHT = 30
const FOLLOW_RATE = 2.6
const FOCUS_HEAD_HEIGHT = 1.5

/**
 * Isometric-ish orthographic camera. On its own it frames the whole room, or zooms in on short "focus"
 * moments (a hand-off, a spilled coffee); once the viewer drags or zooms it stays where they put it.
 * @example
 * const rig = new CameraRig(systemClock)
 * rig.addFocus(() => [parent.position, child.position], 3800)
 * rig.update(seconds, { width: 14, depth: 9, height: 2.6 })
 */
export class CameraRig {
  yaw = DEFAULT_YAW
  pitch = DEFAULT_PITCH
  center = new Vector3(7, 0, 4.5)
  halfHeight = 6
  aspect = 1
  manual = false
  /** @type {Focus[]} */
  #focuses = []
  #clock
  /** @type {(manual: boolean) => void} */
  onManualChange = () => {}

  /** @param {Clock} clock */
  constructor(clock) {
    this.#clock = clock
    this.camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 200)
  }

  /** @param {number} width @param {number} height */
  setViewport(width, height) {
    this.aspect = width / Math.max(1, height)
  }

  /**
   * @param {() => Vector3[]} points Re-read every frame so the camera follows moving agents.
   * @param {number} ms
   */
  addFocus(points, ms) {
    this.#focuses.push({ points, until: this.#clock.now() + ms })
  }

  recenter() {
    this.yaw = DEFAULT_YAW
    this.pitch = DEFAULT_PITCH
    this.setManual(false)
  }

  /** @param {boolean} manual */
  setManual(manual) {
    if (this.manual === manual) return
    this.manual = manual
    this.onManualChange(manual)
  }

  /** @param {number} dx @param {number} dy Pixels dragged. */
  orbit(dx, dy) {
    this.setManual(true)
    this.yaw -= dx * 0.006
    this.pitch = MathUtils.clamp(this.pitch + dy * 0.004, MIN_PITCH, MAX_PITCH)
  }

  /** @param {number} dx @param {number} dy @param {number} viewportHeight */
  pan(dx, dy, viewportHeight) {
    this.setManual(true)
    const { right, up } = this.axes()
    const unitsPerPixel = (this.halfHeight * 2) / Math.max(1, viewportHeight)
    this.center.addScaledVector(right, -dx * unitsPerPixel).addScaledVector(up, dy * unitsPerPixel)
  }

  /** @param {number} wheelDelta */
  zoom(wheelDelta) {
    this.setManual(true)
    this.halfHeight = MathUtils.clamp(
      this.halfHeight * Math.exp(wheelDelta * 0.0012),
      MIN_ZOOM_HALF_HEIGHT,
      MAX_ZOOM_HALF_HEIGHT,
    )
  }

  /** @returns {CameraAxes} */
  axes() {
    const { yaw, pitch } = this
    const forward = new Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    )
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    return { forward, right, up: new Vector3().crossVectors(forward, right).normalize() }
  }

  /**
   * The smallest view (center and half height) that shows every point with a margin.
   * @param {Vector3[]} points
   * @param {number} margin
   * @param {number} minHalfHeight
   * @returns {Framing}
   */
  frame(points, margin, minHalfHeight) {
    const { right, up } = this.axes()
    const across = points.map(point => point.dot(right))
    const vertical = points.map(point => point.dot(up))
    const [minRight, maxRight] = [Math.min(...across), Math.max(...across)]
    const [minUp, maxUp] = [Math.min(...vertical), Math.max(...vertical)]
    const reference = /** @type {Vector3} */ (points[0]).clone()
    const center = reference
      .addScaledVector(right, (minRight + maxRight) / 2 - reference.dot(right))
      .addScaledVector(up, (minUp + maxUp) / 2 - reference.dot(up))
    const needed = Math.max((maxUp - minUp) / 2, (maxRight - minRight) / 2 / this.aspect) * margin
    return { center, halfHeight: Math.max(minHalfHeight, needed) }
  }

  /**
   * @param {number} seconds
   * @param {RoomBounds} room
   */
  update(seconds, room) {
    if (!this.manual) this.#follow(seconds, this.#targetFraming(room))
    const { forward } = this.axes()
    this.camera.position.copy(this.center).addScaledVector(forward, CAMERA_DISTANCE)
    this.camera.lookAt(this.center)
    Object.assign(this.camera, {
      top: this.halfHeight,
      bottom: -this.halfHeight,
      left: -this.halfHeight * this.aspect,
      right: this.halfHeight * this.aspect,
    })
    this.camera.updateProjectionMatrix()
  }

  /**
   * @param {RoomBounds} room
   * @returns {Framing}
   */
  #targetFraming(room) {
    const focusPoints = this.#activeFocusPoints()
    if (focusPoints.length > 0) return this.frame(focusPoints, FOCUS_MARGIN, MIN_FOCUS_HALF_HEIGHT)
    return this.frame(roomCorners(room), ROOM_MARGIN, 0)
  }

  /** @returns {Vector3[]} Each focused position plus a point at head height, so heads stay in view. */
  #activeFocusPoints() {
    const now = this.#clock.now()
    this.#focuses = this.#focuses.filter(focus => focus.until > now)
    return this.#focuses.flatMap(focus =>
      focus.points().flatMap(point => [point.clone(), point.clone().setY(FOCUS_HEAD_HEIGHT)]),
    )
  }

  /**
   * @param {number} seconds
   * @param {Framing} target
   */
  #follow(seconds, target) {
    const blend = 1 - Math.exp(-seconds * FOLLOW_RATE)
    this.center.lerp(target.center, blend)
    this.halfHeight += (target.halfHeight - this.halfHeight) * blend
  }
}

/**
 * The eight corners of the room's box.
 * @param {RoomBounds} room
 * @returns {Vector3[]}
 * @example roomCorners({ width: 14, depth: 9, height: 2.6 }).length // 8
 */
export function roomCorners({ width, depth, height }) {
  return [0, 1, 2, 3, 4, 5, 6, 7].map(
    i => new Vector3(i & 1 ? width : 0, i & 4 ? height : 0, i & 2 ? depth : 0),
  )
}
