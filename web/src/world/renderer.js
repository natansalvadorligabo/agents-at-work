import { PCFShadowMap, WebGLRenderer } from '../lib/three.js'

const MAX_PIXEL_RATIO = 2

/**
 * Creates the WebGL renderer with crisp pixels and soft shadows and mounts its canvas.
 * @param {HTMLElement} container
 * @param {number} devicePixelRatio
 * @returns {WebGLRenderer}
 * @example const renderer = createWebGlRenderer(document.getElementById('scene'), window.devicePixelRatio)
 */
export function createWebGlRenderer(container, devicePixelRatio) {
  const renderer = new WebGLRenderer({ antialias: false, alpha: false })
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  container.append(renderer.domElement)
  return renderer
}

/**
 * Converts a pointer position to normalized device coordinates (-1..1, y up) of an element.
 * @param {{ clientX: number, clientY: number }} pointer
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @returns {{ x: number, y: number }}
 * @example toDeviceCoordinates({ clientX: 50, clientY: 50 }, { left: 0, top: 0, width: 100, height: 100 }) // { x: 0, y: 0 }
 */
export function toDeviceCoordinates(pointer, rect) {
  return {
    x: ((pointer.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((pointer.clientY - rect.top) / rect.height) * 2 + 1,
  }
}
