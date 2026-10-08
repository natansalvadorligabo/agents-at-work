/**
 * @typedef {import('./camera-rig.js').CameraRig} CameraRig
 * @typedef {{ startX: number, startY: number, lastX: number, lastY: number, button: number }} Drag
 */

const DRAG_THRESHOLD_PX = 4
const RIGHT_BUTTON = 2

/**
 * Mouse controls for the camera: left-drag orbits, right-drag (or shift-drag) pans, the wheel zooms.
 * Also remembers whether the last press was a drag, so a drag does not count as a click on an agent.
 * @example
 * const input = new CameraInput(canvas, rig)
 * canvas.addEventListener('click', event => { if (!input.wasDrag) select(event) })
 */
export class CameraInput {
  wasDrag = false
  /** @type {Drag | null} */
  #drag = null
  #element
  #rig

  /**
   * @param {HTMLElement} element
   * @param {CameraRig} rig
   */
  constructor(element, rig) {
    this.#element = element
    this.#rig = rig
    element.addEventListener('contextmenu', event => event.preventDefault())
    element.addEventListener('pointerdown', event => this.#start(event))
    element.addEventListener('pointermove', event => this.#move(event))
    element.addEventListener('pointerup', () => this.#end())
    element.addEventListener('pointercancel', () => this.#end())
    element.addEventListener('wheel', event => this.#wheel(event), { passive: false })
  }

  /** @param {PointerEvent} event */
  #start(event) {
    this.#drag = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      button: event.button,
    }
    this.wasDrag = false
    this.#element.setPointerCapture(event.pointerId)
  }

  /** @param {PointerEvent} event */
  #move(event) {
    const drag = this.#drag
    if (!drag) return
    const [dx, dy] = [event.clientX - drag.lastX, event.clientY - drag.lastY]
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    const travelled = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    if (!this.wasDrag && travelled < DRAG_THRESHOLD_PX) return
    this.wasDrag = true
    if (drag.button === RIGHT_BUTTON || event.shiftKey) this.#rig.pan(dx, dy, this.#element.clientHeight)
    else this.#rig.orbit(dx, dy)
  }

  // The click event fires after pointerup; reset the drag flag only after it had a chance to read it.
  #end() {
    this.#drag = null
    setTimeout(() => (this.wasDrag = false), 0)
  }

  /** @param {WheelEvent} event */
  #wheel(event) {
    event.preventDefault()
    this.#rig.zoom(event.deltaY)
  }
}
