import { AgentStatus } from '#shared/protocol.js'
import { categoryOfTool, toolBubbleText } from './tool-catalog.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('#shared/protocol.js').ToolRecord} ToolRecord
 * @typedef {import('../coffee/coffee-rules.js').CoffeeVisit} CoffeeVisit
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../world/layout.js').StationName} StationName
 * @typedef {import('./poses.js').PoseName} PoseName
 *
 * @typedef {'desk' | 'coffee' | StationName} TargetName
 * @typedef {{ target: TargetName, pose: PoseName, bubble: string }} ActivityPlan
 *
 * @typedef {object} ActivityInput
 * @property {AgentSnapshot} snapshot
 * @property {number} now Epoch milliseconds.
 * @property {TargetName | null} currentTarget Where the agent is or is heading.
 * @property {number} thinkingSince When the current thinking block started.
 * @property {CoffeeVisit | null} coffeeVisit
 * @property {boolean} officeIdle
 * @property {Translator} translator
 */

/** A tool must run this long before the agent gets up and walks to its station. */
export const WALK_TO_STATION_DELAY_MS = 400
/** After a tool finishes, the agent lingers at the station in case the next call needs it again. */
export const LINGER_AFTER_TOOL_MS = 1500
/** Thinking longer than this moves the agent to the whiteboard. */
export const LONG_THINKING_MS = 5000
const NAP_FRAME_MS = 700

/**
 * The newest tool call still running, if any.
 * @param {AgentSnapshot} snapshot
 * @returns {ToolRecord | undefined}
 * @example newestActiveTool(snapshot)?.tool // 'Bash'
 */
export function newestActiveTool(snapshot) {
  return Object.values(snapshot.activeTools).sort((a, b) => b.startedAt - a.startedAt)[0]
}

/**
 * The pose an agent takes once it reaches a target.
 * @param {TargetName} target
 * @returns {PoseName}
 * @example poseAt('coffee') // 'drinkingCoffee'
 */
export function poseAt(target) {
  if (target === 'desk') return 'seated'
  if (target === 'whiteboard') return 'writingOnBoard'
  if (target === 'coffee') return 'drinkingCoffee'
  return 'operating'
}

/**
 * Decides where an agent should be, how it should look and what its bubble says, from its live snapshot.
 * Pure: the controller feeds it the agent's memory and carries the plan out.
 * @param {ActivityInput} input
 * @returns {ActivityPlan}
 * @example planActivity({ snapshot, now: Date.now(), currentTarget: 'desk', thinkingSince: 0, coffeeVisit: null, officeIdle: false, translator })
 */
export function planActivity(input) {
  const tool = newestActiveTool(input.snapshot)
  if (input.coffeeVisit) return { target: 'coffee', pose: 'drinkingCoffee', bubble: input.coffeeVisit.bubble }
  if (tool) return planForTool(tool, input)
  const plan = planWithoutTool(input)
  return input.officeIdle && plan.target === 'desk' && !input.snapshot.thinking ? planNap(input) : plan
}

/**
 * @param {ToolRecord} tool
 * @param {ActivityInput} input
 * @returns {ActivityPlan}
 */
function planForTool(tool, { now, currentTarget, translator }) {
  const category = categoryOfTool(tool.tool)
  const bubble = toolBubbleText(tool, translator)
  if (!category.station) return { target: 'desk', pose: category.pose, bubble }
  // Very short calls do not make the agent get up; it stays wherever it already is.
  const settled = now - tool.startedAt >= WALK_TO_STATION_DELAY_MS || currentTarget === category.station
  const target = settled ? category.station : (currentTarget ?? 'desk')
  return { target, pose: target === category.station ? category.pose : poseAt(target), bubble }
}

/**
 * @param {ActivityInput} input
 * @returns {ActivityPlan}
 */
function planWithoutTool({ snapshot, now, currentTarget, thinkingSince, translator }) {
  const lastTool = snapshot.history[snapshot.history.length - 1]
  const justFinished = lastTool?.endedAt != null && now - lastTool.endedAt < LINGER_AFTER_TOOL_MS
  if (justFinished && currentTarget && currentTarget !== 'desk') {
    return { target: currentTarget, pose: poseAt(currentTarget), bubble: '' }
  }
  if (snapshot.thinking) {
    const long = now - thinkingSince > LONG_THINKING_MS
    return {
      target: long ? 'whiteboard' : 'desk',
      pose: long ? 'writingOnBoard' : 'thinking',
      bubble: translator.t('bubble.thinking'),
    }
  }
  if (snapshot.status === AgentStatus.WAITING) {
    return { target: 'desk', pose: 'waitingSeated', bubble: translator.t('bubble.waitingForYou') }
  }
  return { target: 'desk', pose: 'seated', bubble: '' }
}

/**
 * @param {ActivityInput} input
 * @returns {ActivityPlan}
 */
function planNap({ now, translator }) {
  const z = 'z'.repeat(1 + (Math.floor(now / NAP_FRAME_MS) % 3))
  return { target: 'desk', pose: 'napping', bubble: translator.t('bubble.nap', { z }) }
}
