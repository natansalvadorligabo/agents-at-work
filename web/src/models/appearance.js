import { MAIN_AGENT_TYPE } from '#shared/protocol.js'
import { PALETTE, hashString } from './palette.js'

/**
 * @typedef {object} Appearance
 * @property {string} agentType
 * @property {number} outfit
 * @property {number} skin
 * @property {number} hair
 */

const OUTFIT_COLORS = [
  0x3f8efc, 0x2ec4b6, 0xe76f51, 0x9b5de5, 0xf4a261, 0x43aa8b, 0xef476f, 0x118ab2, 0x8ac926, 0xff924c,
]
const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac]
const HAIR_COLORS = [0x2b1d14, 0x4a3020, 0x8b5a2b, 0x1a1a1a, 0xd4a85a, 0x7a3b1d]
const MAIN_AGENT_HAIR = 0x3b2a20

/**
 * @template T
 * @param {readonly T[]} items
 * @param {number} hash
 * @returns {T}
 */
function pickByHash(items, hash) {
  return /** @type {T} */ (items[hash % items.length])
}

/**
 * Derives a stable look from the agent id; the main agent always wears the navy suit.
 * @param {string} agentId
 * @param {string} agentType
 * @returns {Appearance}
 * @example agentAppearance('main', 'main').outfit === PALETTE.navySuit // true
 */
export function agentAppearance(agentId, agentType) {
  const hash = hashString(agentId)
  const isMain = agentType === MAIN_AGENT_TYPE
  return {
    agentType,
    outfit: isMain ? PALETTE.navySuit : pickByHash(OUTFIT_COLORS, hash),
    skin: pickByHash(SKIN_TONES, hash >>> 4),
    hair: isMain ? MAIN_AGENT_HAIR : pickByHash(HAIR_COLORS, hash >>> 8),
  }
}
