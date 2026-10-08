import { Group } from '../lib/three.js'
import {
  bookshelfModel,
  chairModel,
  deskModel,
  doorFrameModel,
  doorLeafModel,
  globeTableModel,
  phoneTableModel,
  pottedPlantModel,
  rackLedsModel,
  serverRackModel,
  whiteboardModel,
  windowModel,
} from '../models/furniture.js'
import { VOXEL_SIZE, createGlowingVoxelMesh, createVoxelMesh } from '../voxel/voxel-mesh.js'
import { DOOR_ROW, MAIN_DESK } from './layout.js'

/**
 * @typedef {import('../lib/three.js').Scene} Scene
 * @typedef {import('../lib/three.js').Mesh} Mesh
 * @typedef {import('../voxel/voxel-model.js').VoxelModel} VoxelModel
 */

const RACK_FRONT_Z = 0.42 + 6 * VOXEL_SIZE + 0.002
const LED_BLINK_PERIOD_MS = 420
const DOOR_OPEN_ANGLE = -1.35
const DOOR_OPENS_WITHIN = 1.3
const DOOR_SWING_FACTOR = 0.15

/**
 * Places a voxel model on the floor (or at a height) and adds it to the scene.
 * @param {Scene} scene
 * @param {VoxelModel} model
 * @param {[number, number, number]} position
 * @param {number} [rotationY]
 * @returns {Mesh}
 * @example placeModel(scene, pottedPlantModel(), [12.5, 0, 0.45])
 */
export function placeModel(scene, model, [x, y, z], rotationY = 0) {
  const mesh = createVoxelMesh(model)
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotationY
  scene.add(mesh)
  return mesh
}

/**
 * A desk with its chair, pivoted so it can pop in by scaling. Starts collapsed; animate `scale` to show it.
 * @returns {Group}
 * @example scene.add(createDeskSet())
 */
export function createDeskSet() {
  const set = new Group()
  const chair = createVoxelMesh(chairModel(), [5, 0, 5])
  chair.position.set(0, 0, 0.95)
  set.add(createVoxelMesh(deskModel(), [14, 0, 7]), chair)
  set.scale.setScalar(0.001)
  return set
}

/**
 * Blinking LEDs on the server rack.
 * @example leds.update(clock.now())
 */
export class RackLeds {
  /** @param {Scene} scene */
  constructor(scene) {
    this.mesh = createGlowingVoxelMesh(rackLedsModel(), [8, 0, 0])
    this.mesh.position.set(6.5, 0, RACK_FRONT_Z)
    scene.add(this.mesh)
  }

  /** @param {number} now */
  update(now) {
    this.mesh.visible = Math.floor(now / LED_BLINK_PERIOD_MS) % 5 !== 0
  }
}

/**
 * The door swings open whenever someone is close to it.
 * @example door.update(characters.map(c => c.position))
 */
export class OfficeDoor {
  /** @param {Scene} scene */
  constructor(scene) {
    placeModel(scene, doorFrameModel(), [-0.1, 0, DOOR_ROW + 0.5]).castShadow = false
    this.leaf = new Group()
    this.leaf.position.set(-0.05, 0, DOOR_ROW + 0.03)
    this.leaf.add(createVoxelMesh(doorLeafModel(), [1, 0, 0]))
    scene.add(this.leaf)
  }

  /** @param {Iterable<{ x: number, z: number }>} positions */
  update(positions) {
    const someoneNear = [...positions].some(
      ({ x, z }) => Math.hypot(x + 0.2, z - (DOOR_ROW + 0.5)) < DOOR_OPENS_WITHIN,
    )
    const target = someoneNear ? DOOR_OPEN_ANGLE : 0
    this.leaf.rotation.y += (target - this.leaf.rotation.y) * DOOR_SWING_FACTOR
  }
}

/**
 * Everything that never moves: stations along the back wall, plants, window and the main agent's desk.
 * @param {Scene} scene
 * @example placeFixedFurniture(scene)
 */
export function placeFixedFurniture(scene) {
  placeModel(scene, bookshelfModel(), [1.0, 0, 0.32])
  placeModel(scene, whiteboardModel(), [4.0, 0, 0.2])
  placeModel(scene, serverRackModel(), [6.5, 0, 0.42])
  placeModel(scene, windowModel(), [8.5, 0.9, 0.02])
  placeModel(scene, globeTableModel(), [8.5, 0, 0.5])
  placeModel(scene, phoneTableModel(), [10.5, 0, 0.42])
  placeModel(scene, pottedPlantModel(), [12.5, 0, 0.45])
  placeModel(scene, pottedPlantModel(), [0.5, 0, 8.45])
  const mainDesk = createDeskSet()
  mainDesk.position.set(MAIN_DESK.x + 1, 0, MAIN_DESK.z + 0.5)
  mainDesk.scale.setScalar(1)
  scene.add(mainDesk)
}
