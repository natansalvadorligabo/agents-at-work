import { BoxGeometry, Color, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial } from '../lib/three.js'
import { DOOR_ROW, ROOM_DEPTH, WALL_HEIGHT, WALL_THICKNESS } from './layout.js'

/** @typedef {import('../lib/three.js').Scene} Scene */

const MAX_FLOOR_TILES = 4096
const FLOOR_COLORS = [0xd8b98a, 0xcdac7c]
const WALL_COLOR = 0xe6dccb
const SKIRTING_COLOR = 0x8c6b4a
const SKIRTING_HEIGHT = 0.18
const DOOR_HEIGHT = 2.2
// Two faces in the same plane flicker as the camera turns (z-fighting), so no two faces here share one:
// the walls stop inside the door frame's posts (z 5.875 to 6 and 7 to 7.125), the skirting runs a little
// past the wall's free ends to cover them, and the back wall alone fills the corner.
const DOOR_JAMB_INSET = 0.06
const SKIRTING_WRAP = 0.02

/**
 * The room itself: a checkered floor, the back wall (which stretches as desks are added) and the left wall
 * with the door opening.
 * @example
 * const shell = new RoomShell(scene)
 * shell.resize(17)
 */
export class RoomShell {
  #wallMaterial = new MeshLambertMaterial({ color: WALL_COLOR })
  #skirtingMaterial = new MeshLambertMaterial({ color: SKIRTING_COLOR })

  /** @param {Scene} scene */
  constructor(scene) {
    this.floor = new InstancedMesh(new BoxGeometry(1, 0.08, 1), new MeshLambertMaterial(), MAX_FLOOR_TILES)
    this.floor.receiveShadow = true
    this.floor.count = 0
    this.backWall = this.#box(1, WALL_HEIGHT, WALL_THICKNESS, this.#wallMaterial)
    this.backSkirting = this.#box(1, SKIRTING_HEIGHT, WALL_THICKNESS + 0.04, this.#skirtingMaterial)
    scene.add(this.floor, this.backWall, this.backSkirting, ...this.#leftWall())
  }

  /**
   * Re-tiles the floor and stretches the back wall to the room width.
   * @param {number} width
   */
  resize(width) {
    this.#tileFloor(width)
    const center = width / 2 - WALL_THICKNESS / 2
    this.backWall.scale.x = width + WALL_THICKNESS
    this.backWall.position.set(center, WALL_HEIGHT / 2, -WALL_THICKNESS / 2)
    this.backSkirting.scale.x = width + WALL_THICKNESS + 2 * SKIRTING_WRAP
    this.backSkirting.position.set(center, SKIRTING_HEIGHT / 2, -WALL_THICKNESS / 2)
  }

  /** @param {number} width */
  #tileFloor(width) {
    const matrix = new Matrix4()
    const color = new Color()
    const count = Math.min(MAX_FLOOR_TILES, width * ROOM_DEPTH)
    for (let index = 0; index < count; index++) {
      const x = index % width
      const z = Math.floor(index / width)
      this.floor.setMatrixAt(index, matrix.makeTranslation(x + 0.5, -0.04, z + 0.5))
      this.floor.setColorAt(index, color.setHex(FLOOR_COLORS[(x + z) % 2] ?? 0))
    }
    this.floor.count = count
    this.floor.instanceMatrix.needsUpdate = true
    if (this.floor.instanceColor) this.floor.instanceColor.needsUpdate = true
  }

  /** @returns {Mesh[]} Two wall segments around the door, with their skirting, and the lintel. */
  #leftWall() {
    const doorStart = DOOR_ROW - DOOR_JAMB_INSET
    const doorEnd = DOOR_ROW + 1 + DOOR_JAMB_INSET
    const lintelDepth = doorEnd - doorStart
    const lintel = this.#box(WALL_THICKNESS, WALL_HEIGHT - DOOR_HEIGHT, lintelDepth, this.#wallMaterial)
    lintel.position.set(-WALL_THICKNESS / 2, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, DOOR_ROW + 0.5)
    return [
      this.#wallSlab(0, doorStart, WALL_HEIGHT, WALL_THICKNESS, this.#wallMaterial),
      this.#wallSlab(
        SKIRTING_WRAP,
        doorStart,
        SKIRTING_HEIGHT,
        WALL_THICKNESS + 0.04,
        this.#skirtingMaterial,
      ),
      this.#wallSlab(doorEnd, ROOM_DEPTH, WALL_HEIGHT, WALL_THICKNESS, this.#wallMaterial),
      this.#wallSlab(
        doorEnd,
        ROOM_DEPTH + SKIRTING_WRAP,
        SKIRTING_HEIGHT,
        WALL_THICKNESS + 0.04,
        this.#skirtingMaterial,
      ),
      lintel,
    ]
  }

  /**
   * A slab along the left wall, from `start` to `end` on the z axis.
   * @param {number} start
   * @param {number} end
   * @param {number} height
   * @param {number} thickness
   * @param {MeshLambertMaterial} material
   * @returns {Mesh}
   */
  #wallSlab(start, end, height, thickness, material) {
    const slab = this.#box(thickness, height, end - start, material)
    slab.position.set(-WALL_THICKNESS / 2, height / 2, (start + end) / 2)
    return slab
  }

  /**
   * @param {number} width
   * @param {number} height
   * @param {number} depth
   * @param {MeshLambertMaterial} material
   * @returns {Mesh}
   */
  #box(width, height, depth, material) {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material)
    mesh.receiveShadow = true
    return mesh
  }
}
