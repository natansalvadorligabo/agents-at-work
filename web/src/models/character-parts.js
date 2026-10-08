import { MAIN_AGENT_TYPE } from '#shared/protocol.js'
import { VoxelModel } from '../voxel/voxel-model.js'
import { PALETTE, blend } from './palette.js'

/** @typedef {import('./appearance.js').Appearance} Appearance */

const EXPLORE = 'Explore'
const PLAN = 'Plan'
const TORSO_FRONT = 4
const HEAD_FRONT = 6

/**
 * @param {Appearance} look
 * @returns {VoxelModel}
 * @example legModel(agentAppearance('a', 'Explore'))
 */
export function legModel(look) {
  const trousers = look.agentType === EXPLORE ? 0x4b3b2a : PALETTE.darkTrousers
  return new VoxelModel(3, 6, 4).fill(0, 2, 0, 2, 5, 3, trousers).fill(0, 0, 0, 2, 1, 3, PALETTE.shoe)
}

/**
 * @param {Appearance} look
 * @returns {VoxelModel}
 * @example armModel(agentAppearance('a', 'general-purpose'))
 */
export function armModel(look) {
  const sleeve = look.agentType === EXPLORE ? PALETTE.beigeTrenchCoat : look.outfit
  return new VoxelModel(2, 6, 3).fill(0, 2, 0, 1, 5, 2, sleeve).fill(0, 0, 0, 1, 1, 2, look.skin)
}

/** @param {Appearance} look @returns {VoxelModel} */
function suitTorso(look) {
  return new VoxelModel(8, 7, 5)
    .fill(0, 0, 0, 7, 6, 4, look.outfit)
    .fill(2, 2, TORSO_FRONT, 5, 6, TORSO_FRONT, PALETTE.shirtWhite)
    .fill(3, 1, TORSO_FRONT, 4, 5, TORSO_FRONT, PALETTE.redTie)
    .paint(3, 6, TORSO_FRONT, PALETTE.shirtWhite)
    .paint(4, 6, TORSO_FRONT, PALETTE.shirtWhite)
}

/** @returns {VoxelModel} */
function trenchCoatTorso() {
  return new VoxelModel(8, 7, 5)
    .fill(0, 0, 0, 7, 6, 4, PALETTE.beigeTrenchCoat)
    .fill(3, 0, TORSO_FRONT, 4, 6, TORSO_FRONT, 0x9c7845)
    .fill(0, 1, 0, 7, 1, 4, 0x6b4f2a)
    .paint(2, 4, TORSO_FRONT, 0x6b4f2a)
    .paint(5, 4, TORSO_FRONT, 0x6b4f2a)
}

/** @param {Appearance} look @returns {VoxelModel} */
function safetyVestTorso(look) {
  return new VoxelModel(8, 7, 5)
    .fill(0, 0, 0, 7, 6, 4, look.outfit)
    .fill(0, 0, 0, 1, 5, 4, PALETTE.orangeVest)
    .fill(6, 0, 0, 7, 5, 4, PALETTE.orangeVest)
    .fill(0, 0, 0, 7, 5, 0, PALETTE.orangeVest)
    .fill(0, 2, 0, 7, 2, 4, PALETTE.vestStripe)
}

/** @param {Appearance} look @returns {VoxelModel} */
function casualTorso(look) {
  return new VoxelModel(8, 7, 5)
    .fill(0, 0, 0, 7, 6, 4, look.outfit)
    .fill(2, 6, TORSO_FRONT, 5, 6, TORSO_FRONT, PALETTE.shirtWhite)
    .paint(3, 5, TORSO_FRONT, PALETTE.shirtWhite)
    .paint(4, 5, TORSO_FRONT, PALETTE.shirtWhite)
    .fill(3, 0, TORSO_FRONT, 4, 4, TORSO_FRONT, blend(look.outfit, 0xffffff, 0.25))
    .fill(0, 0, 0, 7, 0, 4, PALETTE.darkTrousers)
}

/**
 * The torso tells the agent type apart: suit (main), trench coat (Explore), safety vest (Plan), casual otherwise.
 * @param {Appearance} look
 * @returns {VoxelModel}
 * @example torsoModel(agentAppearance('main', 'main'))
 */
export function torsoModel(look) {
  if (look.agentType === MAIN_AGENT_TYPE) return suitTorso(look)
  if (look.agentType === EXPLORE) return trenchCoatTorso()
  if (look.agentType === PLAN) return safetyVestTorso(look)
  return casualTorso(look)
}

/**
 * @param {Appearance} look
 * @returns {VoxelModel}
 * @example headModel(agentAppearance('a', 'Plan'))
 */
export function headModel(look) {
  const head = new VoxelModel(8, 7, 7)
    .fill(0, 0, 0, 7, 6, 6, look.skin)
    .fill(0, 5, 0, 7, 6, 6, look.hair)
    .fill(0, 1, 0, 7, 4, 1, look.hair)
    .fill(0, 3, 0, 0, 4, 4, look.hair)
    .fill(7, 3, 0, 7, 4, 4, look.hair)
  const blush = blend(look.skin, 0xff7f7f, 0.25)
  head.paint(2, 3, HEAD_FRONT, PALETTE.eyeBlack).paint(5, 3, HEAD_FRONT, PALETTE.eyeBlack)
  head.paint(2, 2, HEAD_FRONT, blush).paint(5, 2, HEAD_FRONT, blush)
  head.fill(3, 1, HEAD_FRONT, 4, 1, HEAD_FRONT, blend(look.skin, 0x000000, 0.35))
  if (look.agentType === MAIN_AGENT_TYPE) head.fill(1, 6, 0, 6, 6, 5, blend(look.hair, 0xaaaaaa, 0.35))
  return head
}

/** @returns {VoxelModel} */
function detectiveHat() {
  return new VoxelModel(12, 4, 11)
    .fill(0, 0, 0, 11, 0, 10, PALETTE.brownHat)
    .fill(2, 1, 2, 9, 3, 8, PALETTE.brownHat)
    .fill(2, 1, 2, 9, 1, 8, PALETTE.hatBand)
    .clear(5, 3, 3, 6, 3, 7)
}

/** @returns {VoxelModel} */
function hardHat() {
  return new VoxelModel(10, 4, 10)
    .fill(1, 0, 1, 8, 2, 8, PALETTE.yellowHelmet)
    .fill(2, 3, 2, 7, 3, 7, PALETTE.yellowHelmet)
    .fill(1, 0, 9, 8, 0, 9, PALETTE.helmetShade)
    .fill(4, 1, 1, 5, 3, 8, PALETTE.helmetShade)
}

/** @param {Appearance} look @returns {VoxelModel} */
function baseballCap(look) {
  return new VoxelModel(9, 3, 11)
    .fill(0, 0, 0, 8, 2, 7, look.outfit)
    .fill(1, 0, 8, 7, 0, 10, blend(look.outfit, 0x000000, 0.3))
    .paint(4, 2, 3, PALETTE.shirtWhite)
}

/**
 * The main agent and general-purpose agents go bareheaded; custom agent types get a cap in their color.
 * @param {Appearance} look
 * @returns {VoxelModel | null}
 * @example hatModel(agentAppearance('a', 'Explore')) // detective hat
 */
export function hatModel(look) {
  if (look.agentType === EXPLORE) return detectiveHat()
  if (look.agentType === PLAN) return hardHat()
  if (look.agentType === MAIN_AGENT_TYPE || look.agentType === 'general-purpose') return null
  return baseballCap(look)
}

/** Hat height above the neck, in voxels, per agent type. */
export const HAT_HEIGHT_BY_TYPE = /** @type {Record<string, number>} */ ({ [EXPLORE]: 18.5, [PLAN]: 19 })
export const DEFAULT_HAT_HEIGHT = 19.5

/**
 * The prop an agent type always carries: a magnifying glass (Explore) or a blueprint roll (Plan).
 * @param {Appearance} look
 * @returns {VoxelModel | null}
 * @example heldItemModel(agentAppearance('a', 'Plan'))
 */
export function heldItemModel(look) {
  if (look.agentType === EXPLORE) {
    return new VoxelModel(5, 8, 1)
      .fill(2, 0, 0, 2, 3, 0, PALETTE.darkWood)
      .fill(0, 4, 0, 4, 7, 0, PALETTE.brassRim)
      .fill(1, 5, 0, 3, 6, 0, PALETTE.lensGlass)
  }
  if (look.agentType !== PLAN) return null
  return new VoxelModel(2, 2, 8)
    .fill(0, 0, 0, 1, 1, 7, PALETTE.blueprintBlue)
    .fill(0, 0, 0, 1, 1, 0, PALETTE.blueprintLight)
    .fill(0, 0, 7, 1, 1, 7, PALETTE.blueprintLight)
}
