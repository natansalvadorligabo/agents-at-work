import { Vector3 } from '../lib/three.js'

/**
 * @typedef {import('../lib/three.js').Camera} Camera
 * @typedef {import('../agents/character.js').Character} Character
 * @typedef {{ width: number, height: number }} Viewport
 */

const scratch = new Vector3()

/**
 * Converts a world point to viewport pixels.
 * @param {Vector3} point Overwritten with its normalized device coordinates.
 * @param {Camera} camera
 * @param {Viewport} viewport
 * @returns {{ x: number, y: number }}
 * @example toScreen(character.headTop(), rig.camera, { width: 800, height: 600 })
 */
export function toScreen(point, camera, viewport) {
  point.project(camera)
  return { x: (point.x * 0.5 + 0.5) * viewport.width, y: (-point.y * 0.5 + 0.5) * viewport.height }
}

/**
 * Pins every nameplate and speech bubble above its character's head; hidden while the character pops in/out.
 * @param {Character[]} characters
 * @param {Camera} camera
 * @param {Viewport} viewport
 * @example placeLabels(roster.characters(), rig.camera, viewport)
 */
export function placeLabels(characters, camera, viewport) {
  for (const character of characters) {
    const { x, y } = toScreen(character.headTop(scratch), camera, viewport)
    const opacity = character.isVisible ? 1 : 0
    character.nameplate.place(x, y, opacity)
    character.bubble.place(x, y, opacity)
  }
}
