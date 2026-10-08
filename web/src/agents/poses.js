import { VOXEL_SIZE as V } from '../voxel/voxel-mesh.js'

/**
 * @typedef {'standing' | 'walking' | 'seated' | 'typing' | 'thinking' | 'waitingSeated' | 'napping' | 'operating'
 *   | 'writingOnBoard' | 'handingOver' | 'drinkingCoffee' | 'raisingHand'} PoseName
 *
 * Target joint angles (radians) and body offsets (world units) for one animation frame.
 * @typedef {object} JointTargets
 * @property {number} leftLeg
 * @property {number} rightLeg
 * @property {number} leftArm
 * @property {number} rightArm
 * @property {number} rightArmSpread
 * @property {number} headPitch
 * @property {number} headRoll
 * @property {number} bodyLift
 *
 * @typedef {object} PoseContext
 * @property {number} time Seconds of animation time.
 * @property {boolean} carrying Holding an envelope keeps the right arm forward.
 * @property {number} phase Per-agent offset so a group does not move in lockstep.
 *
 * @typedef {(context: PoseContext) => Partial<JointTargets>} PoseFunction
 */

export const SEAT_HEIGHT = 3 * V

/** @type {JointTargets} */
const REST = Object.freeze({
  leftLeg: 0,
  rightLeg: 0,
  leftArm: 0,
  rightArm: 0,
  rightArmSpread: 0,
  headPitch: 0,
  headRoll: 0,
  bodyLift: 0,
})

const SITTING = { leftLeg: -Math.PI / 2, rightLeg: -Math.PI / 2, bodyLift: SEAT_HEIGHT }
const CARRYING_ARM = -0.9

/** @type {Record<PoseName, PoseFunction>} */
const POSES = {
  standing: ({ time, carrying }) => ({
    leftArm: Math.sin(time * 1.6) * 0.04,
    rightArm: carrying ? CARRYING_ARM : -Math.sin(time * 1.6) * 0.04,
    bodyLift: Math.sin(time * 2.2) * 0.25 * V,
  }),
  walking: ({ time, carrying }) => {
    const stride = Math.sin(time * 11)
    return {
      leftLeg: stride * 0.65,
      rightLeg: -stride * 0.65,
      leftArm: -stride * 0.55,
      rightArm: carrying ? CARRYING_ARM : stride * 0.55,
      bodyLift: Math.abs(Math.cos(time * 11)) * 0.8 * V,
    }
  },
  seated: () => ({ ...SITTING, leftArm: -0.6, rightArm: -0.6 }),
  typing: ({ time }) => ({
    ...SITTING,
    leftArm: -1.15 + Math.sin(time * 18) * 0.12,
    rightArm: -1.15 + Math.sin(time * 18 + 1.7) * 0.12,
    headPitch: 0.12,
  }),
  thinking: ({ time }) => ({
    ...SITTING,
    rightArm: -2.3,
    rightArmSpread: 0.35,
    headRoll: Math.sin(time * 1.4) * 0.12,
    headPitch: -0.15,
  }),
  waitingSeated: ({ time }) => ({
    ...SITTING,
    leftArm: -0.5,
    rightArm: -0.5,
    headPitch: -0.1 + Math.sin(time * 2) * 0.05,
  }),
  napping: ({ time }) => {
    const breath = Math.sin(time * 1.3)
    return {
      ...SITTING,
      leftArm: -0.25,
      rightArm: -0.25,
      headPitch: 0.55 + breath * 0.06,
      headRoll: 0.18,
      bodyLift: SEAT_HEIGHT + breath * 0.3 * V,
    }
  },
  operating: ({ time }) => ({
    leftArm: -1.1 + Math.sin(time * 5) * 0.15,
    rightArm: -1.25 + Math.sin(time * 5 + 2) * 0.2,
    headPitch: 0.1,
  }),
  writingOnBoard: ({ time }) => ({
    rightArm: -2.6 + Math.sin(time * 6) * 0.25,
    rightArmSpread: Math.sin(time * 3) * 0.2,
    leftArm: -0.2,
    headPitch: -0.2,
  }),
  handingOver: () => ({ rightArm: -1.45 }),
  // Waiting for permission: the right hand up, waving a little so it catches the eye.
  raisingHand: ({ time }) => ({
    rightArm: -2.9 + Math.sin(time * 8) * 0.3,
    headRoll: Math.sin(time * 2) * 0.1,
  }),
  drinkingCoffee: ({ time, phase }) => {
    // Holds the mug and, once per cycle, takes a sip with the head tilted back.
    const sipping = (time + phase) % 4 > 2.9
    return {
      rightArm: sipping ? -2.5 : -1.3,
      leftArm: -0.15,
      headPitch: sipping ? -0.3 : 0.05,
      bodyLift: Math.sin(time * 2.2) * 0.25 * V,
    }
  },
}

/**
 * Joint targets for a pose at a moment in time; joints the pose does not mention rest at zero.
 * @param {PoseName} pose
 * @param {PoseContext} context
 * @returns {JointTargets}
 * @example poseTargets('seated', { time: 0, carrying: false, phase: 0 }).bodyLift // SEAT_HEIGHT
 */
export function poseTargets(pose, context) {
  return { ...REST, ...POSES[pose](context) }
}

/** Poses in which the character is sitting on its chair. */
export const SEATED_POSES = new Set(
  /** @type {PoseName[]} */ (['seated', 'typing', 'thinking', 'waitingSeated', 'napping']),
)
