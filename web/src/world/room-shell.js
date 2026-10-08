import { BoxGeometry, Color, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial } from '../lib/three.js'
import { DOOR_ROW, ROOM_DEPTH, WALL_HEIGHT, WALL_THICKNESS } from './layout.js'

/** @typedef {import('../lib/three.js').Scene} Scene */

const MAX_FLOOR_TILES = 4096
const FLOOR_COLORS = [0xd8b98a, 0xcdac7c]
const WALL_COLOR = 0xe6dccb
const SKIRTING_COLOR = 0x8c6b4a
const SKIRTING_HEIGHT = 0.18
const DOOR_HEIGHT = 2.2

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
    const length = width + WALL_THICKNESS
    for (const mesh of [this.backWall, this.backSkirting]) mesh.scale.x = length
    this.backWall.position.set(width / 2 - WALL_THICKNESS / 2, WALL_HEIGHT / 2, -WALL_THICKNESS / 2)
    this.backSkirting.position.set(width / 2 - WALL_THICKNESS / 2, SKIRTING_HEIGHT / 2, -WALL_THICKNESS / 2)
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
    const segments = [
      [-WALL_THICKNESS, DOOR_ROW],
      [DOOR_ROW + 1, ROOM_DEPTH],
    ].flatMap(([start = 0, end = 0]) => this.#leftWallSegment(start, end))
    const lintel = this.#box(WALL_THICKNESS, WALL_HEIGHT - DOOR_HEIGHT, 1, this.#wallMaterial)
    lintel.position.set(-WALL_THICKNESS / 2, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, DOOR_ROW + 0.5)
    return [...segments, lintel]
  }

  /**
   * @param {number} start
   * @param {number} end
   * @returns {Mesh[]}
   */
  #leftWallSegment(start, end) {
    const length = end - start
    const wall = this.#box(WALL_THICKNESS, WALL_HEIGHT, length, this.#wallMaterial)
    wall.position.set(-WALL_THICKNESS / 2, WALL_HEIGHT / 2, start + length / 2)
    const skirting = this.#box(WALL_THICKNESS + 0.04, SKIRTING_HEIGHT, length, this.#skirtingMaterial)
    skirting.position.set(-WALL_THICKNESS / 2, SKIRTING_HEIGHT / 2, start + length / 2)
    return [wall, skirting]
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
