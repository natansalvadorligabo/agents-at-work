import { VoxelModel } from '../voxel/voxel-model.js'
import { PALETTE } from './palette.js'

/** @typedef {'task' | 'result' | 'failure'} DeliveryKind */

/** @returns {VoxelModel} */
function crumpledPaper() {
  return new VoxelModel(4, 4, 4)
    .fill(0, 1, 0, 3, 2, 3, PALETTE.crumpledPaper)
    .fill(1, 0, 1, 2, 3, 2, PALETTE.crumpledPaper)
    .clear(0, 1, 0, 0, 1, 0)
    .clear(3, 2, 3, 3, 2, 3)
    .paint(1, 3, 2, 0x9e9e94)
}

/**
 * What changes hands between agents: a sealed envelope (red: task, green: result) or a crumpled failure.
 * @param {DeliveryKind} kind
 * @returns {VoxelModel}
 * @example envelopeModel('result')
 */
export function envelopeModel(kind) {
  if (kind === 'failure') return crumpledPaper()
  const fold = PALETTE.envelopeFold
  return new VoxelModel(7, 5, 1)
    .fill(0, 0, 0, 6, 4, 0, PALETTE.envelopePaper)
    .paint(0, 4, 0, fold)
    .paint(1, 3, 0, fold)
    .paint(2, 2, 0, fold)
    .paint(6, 4, 0, fold)
    .paint(5, 3, 0, fold)
    .paint(4, 2, 0, fold)
    .paint(3, 2, 0, kind === 'result' ? PALETTE.greenSeal : PALETTE.redSeal)
}

/**
 * The mug agents hold at the coffee machine.
 * @returns {VoxelModel}
 * @example mugModel().filledCount > 0 // true
 */
export function mugModel() {
  return new VoxelModel(4, 4, 3)
    .fill(0, 0, 0, 2, 3, 2, PALETTE.mugWhite)
    .paint(1, 3, 1, PALETTE.darkCoffee)
    .paint(3, 1, 1, PALETTE.mugWhite)
    .paint(3, 2, 1, PALETTE.mugWhite)
}

/**
 * The irregular puddle left behind when a failing command makes an agent spill their coffee.
 * @returns {VoxelModel}
 * @example coffeePuddleModel().height // 1
 */
export function coffeePuddleModel() {
  return new VoxelModel(12, 1, 10).paintEach((x, _y, z) => {
    const distance = Math.hypot((x - 5.5) * 0.9, z - 4.5) + Math.sin(x * 1.7 + z * 2.3) * 0.8
    return distance < 4.6 ? PALETTE.darkCoffee : null
  })
}
