import { Group } from '../lib/three.js'
import { VOXEL_SIZE as V, createVoxelMesh } from '../voxel/voxel-mesh.js'
import {
  DEFAULT_HAT_HEIGHT,
  HAT_HEIGHT_BY_TYPE,
  armModel,
  hatModel,
  headModel,
  heldItemModel,
  legModel,
  torsoModel,
} from '../models/character-parts.js'
import { mugModel } from '../models/props.js'

/**
 * @typedef {import('../lib/three.js').Object3D} Object3D
 * @typedef {import('../models/appearance.js').Appearance} Appearance
 *
 * @typedef {object} CharacterRig
 * @property {Group} root Positioned on the floor and turned to face the walking direction.
 * @property {Group} body Scaled to pop in/out; lifted and jittered by poses.
 * @property {Group} leftLeg
 * @property {Group} rightLeg
 * @property {Group} leftArm
 * @property {Group} rightArm
 * @property {Group} head
 * @property {Group} rightHand Anchor for envelopes, the mug and the type's prop.
 * @property {Object3D | null} typeItem
 * @property {Object3D} mug
 */

/**
 * @param {Group} body
 * @param {Object3D} mesh
 * @param {[number, number, number]} jointInVoxels
 * @returns {Group}
 */
function attachJoint(body, mesh, [x, y, z]) {
  const joint = new Group()
  joint.position.set(x * V, y * V, z * V)
  joint.add(mesh)
  body.add(joint)
  return joint
}

/**
 * @param {Group} head
 * @param {Appearance} look
 */
function attachHat(head, look) {
  const hat = hatModel(look)
  if (!hat) return
  const mesh = createVoxelMesh(hat)
  mesh.position.y = ((HAT_HEIGHT_BY_TYPE[look.agentType] ?? DEFAULT_HAT_HEIGHT) - 13) * V
  head.add(mesh)
}

/**
 * @param {Group} rightHand
 * @param {Appearance} look
 * @returns {Object3D | null}
 */
function attachTypeItem(rightHand, look) {
  const item = heldItemModel(look)
  if (!item) return null
  const mesh = createVoxelMesh(item, [item.width / 2, 1, item.depth / 2])
  rightHand.add(mesh)
  return mesh
}

/**
 * @param {Group} rightHand
 * @returns {Object3D}
 */
function attachMug(rightHand) {
  const mug = createVoxelMesh(mugModel(), [1.5, 0, 1.5])
  mug.rotation.x = Math.PI / 2
  mug.position.z = 1 * V
  mug.visible = false
  rightHand.add(mug)
  return mug
}

/**
 * @param {Appearance} look
 * @param {Group} body
 * @returns {Omit<CharacterRig, 'root' | 'body' | 'rightHand' | 'typeItem' | 'mug'>}
 */
function attachLimbs(look, body) {
  const head = attachJoint(body, createVoxelMesh(headModel(look), [4, 0, 3.5]), [0, 13, 0])
  attachJoint(body, createVoxelMesh(torsoModel(look), [4, 0, 2.5]), [0, 6, 0])
  attachHat(head, look)
  return {
    leftLeg: attachJoint(body, createVoxelMesh(legModel(look), [1.5, 6, 2]), [-2, 6, 0]),
    rightLeg: attachJoint(body, createVoxelMesh(legModel(look), [1.5, 6, 2]), [2, 6, 0]),
    leftArm: attachJoint(body, createVoxelMesh(armModel(look), [1, 6, 1.5]), [-5, 13, 0]),
    rightArm: attachJoint(body, createVoxelMesh(armModel(look), [1, 6, 1.5]), [5, 13, 0]),
    head,
  }
}

/**
 * Assembles a blocky character from voxel parts, with pivots at the hips, shoulders and neck.
 * @param {Appearance} look
 * @returns {CharacterRig}
 * @example scene.add(buildCharacterRig(agentAppearance('a1', 'Explore')).root)
 */
export function buildCharacterRig(look) {
  const root = new Group()
  const body = new Group()
  root.add(body)
  const limbs = attachLimbs(look, body)
  const rightHand = new Group()
  rightHand.position.set(0, -5.5 * V, 1 * V)
  limbs.rightArm.add(rightHand)
  return {
    root,
    body,
    ...limbs,
    rightHand,
    typeItem: attachTypeItem(rightHand, look),
    mug: attachMug(rightHand),
  }
}
