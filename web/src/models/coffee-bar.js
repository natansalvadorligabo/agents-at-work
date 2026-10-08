import { VoxelModel } from '../voxel/voxel-model.js'
import { PALETTE } from './palette.js'

const WIDTH = 30
const HEIGHT = 31
const DEPTH = 12

/** Voxel where the steam leaves the jug, in the counter model's own coordinates. */
export const JUG_SPOUT_VOXEL = /** @type {const} */ ([7.5, 25, 6.5])
/** Pivot used for the counter and its light, so both line up. */
export const COFFEE_BAR_PIVOT = /** @type {const} */ ([15, 0, 6])

/** @param {VoxelModel} bar */
function addCabinet(bar) {
  bar
    .fill(0, 0, 0, 29, 13, 11, PALETTE.darkWood)
    .fill(0, 14, 0, 29, 14, 11, PALETTE.woodTop)
    .fill(2, 2, 11, 13, 12, 11, PALETTE.lightWood)
    .fill(16, 2, 11, 27, 12, 11, PALETTE.lightWood)
    .fill(12, 7, 11, 12, 9, 11, PALETTE.brassRim)
    .fill(17, 7, 11, 17, 9, 11, PALETTE.brassRim)
}

/** @param {VoxelModel} bar */
function addCoffeeMachine(bar) {
  bar
    .fill(3, 15, 1, 12, 16, 8, PALETTE.darkMetal)
    .fill(3, 17, 1, 12, 30, 4, PALETTE.coffeeMachineBody)
    .fill(3, 27, 1, 12, 30, 8, PALETTE.coffeeMachineBody)
    .fill(5, 17, 5, 10, 19, 8, PALETTE.darkCoffee)
    .fill(5, 20, 5, 10, 23, 8, PALETTE.skyGlass)
    .fill(11, 18, 6, 11, 22, 7, PALETTE.coffeeMachineBody)
    .fill(5, 24, 5, 10, 24, 8, PALETTE.greyMetal)
}

/** @param {VoxelModel} bar */
function addMugsAndSugar(bar) {
  bar
    .fill(17, 15, 6, 19, 17, 8, PALETTE.mugWhite)
    .paint(18, 17, 7, PALETTE.darkCoffee)
    .paint(20, 16, 7, PALETTE.mugWhite)
    .fill(22, 15, 5, 24, 17, 7, PALETTE.redPhone)
    .paint(23, 17, 6, PALETTE.darkCoffee)
    .paint(25, 16, 6, PALETTE.redPhone)
    .fill(26, 15, 1, 28, 18, 3, PALETTE.skyGlassLight)
    .fill(26, 19, 1, 28, 19, 3, PALETTE.greyMetal)
}

/**
 * The coffee counter: cabinet, drip machine with a jug, two mugs and a sugar jar. Its front (z) faces the room.
 * @returns {VoxelModel}
 * @example createVoxelMesh(coffeeBarModel(), [...COFFEE_BAR_PIVOT])
 */
export function coffeeBarModel() {
  const bar = new VoxelModel(WIDTH, HEIGHT, DEPTH)
  addCabinet(bar)
  addCoffeeMachine(bar)
  addMugsAndSugar(bar)
  return bar
}

/**
 * The machine's power light. Same size as the counter so it shares the pivot; only one voxel is painted.
 * @returns {VoxelModel}
 * @example createGlowingVoxelMesh(coffeeMachineLightModel(), [...COFFEE_BAR_PIVOT])
 */
export function coffeeMachineLightModel() {
  return new VoxelModel(WIDTH, HEIGHT, DEPTH).paint(4, 28, 9, PALETTE.coffeeMachineLight)
}
