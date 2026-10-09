import { DELEGATION_TOOLS, categoryOfTool } from '../agents/tool-catalog.js'

// The coffee machine is where blocked time goes: an agent at the coffee machine is waiting, not working.

/**
 * @typedef {import('#shared/protocol.js').ToolRecord} ToolRecord
 * @typedef {import('../i18n/translator.js').Translator} Translator
 *
 * @typedef {{ reason: 'compiling', toolUseId: string, bubble: string } | { reason: 'delegated', bubble: string }} CoffeeVisit
 *
 * @typedef {object} CoffeeSituation
 * @property {ToolRecord | undefined} currentTool The newest tool still running.
 * @property {number} now Epoch milliseconds.
 * @property {boolean} thinking
 * @property {number} childCount Subagents this agent spawned that are still around.
 * @property {number} [arrivingChildCount] Of those, the ones still coming in for their task envelope.
 * @property {boolean} atCoffee Already on a coffee break (no new waiting period needed).
 */

/** A terminal command running longer than this sends the agent for coffee ("it's compiling"). */
export const COMPILING_THRESHOLD_MS = 10000
/** How long an agent waits on its subagents at the desk before giving up and getting coffee. */
export const DELEGATION_THRESHOLD_MS = 3000
/** From this many cups on, arriving at the coffee machine makes the agent shake. */
export const CUPS_TO_FEEL_GREAT = 5
export const SHAKE_DURATION_MS = 6000

/**
 * Whether a running tool is a terminal command that has been going long enough to justify a coffee.
 * @param {ToolRecord} tool
 * @param {number} now
 * @returns {boolean}
 * @example isLongCompile({ tool: 'Bash', startedAt: 0, …}, 11000) // true
 */
export function isLongCompile(tool, now) {
  return categoryOfTool(tool.tool).station === 'rack' && now - tool.startedAt >= COMPILING_THRESHOLD_MS
}

/**
 * Decides, frame by frame, whether an agent should be at the coffee machine and why. Remembers since when
 * the agent has been waiting on its subagents, so short waits do not send it away from the desk.
 * @example
 * const reasoner = new CoffeeReasoner(translator)
 * reasoner.reasonFor({ currentTool, now: Date.now(), thinking: false, childCount: 2, atCoffee: false })
 */
export class CoffeeReasoner {
  #waitingSince = 0
  #translator

  /** @param {Translator} translator */
  constructor(translator) {
    this.#translator = translator
  }

  /**
   * @param {CoffeeSituation} situation
   * @returns {CoffeeVisit | null}
   */
  reasonFor(situation) {
    const { currentTool, now, thinking } = situation
    if (currentTool && isLongCompile(currentTool, now)) return this.#compilingVisit(currentTool)
    const busyElsewhere = currentTool ? !DELEGATION_TOOLS.test(currentTool.tool) : thinking
    // Still handing out tasks: new hires come to the desk for their envelope, so it stays there.
    const handingOut = (situation.arrivingChildCount ?? 0) > 0
    if (busyElsewhere || handingOut || situation.childCount === 0) return this.#stopWaiting()
    return this.#delegationVisit(situation)
  }

  /**
   * @param {ToolRecord} tool
   * @returns {CoffeeVisit}
   */
  #compilingVisit(tool) {
    const bubble = this.#translator.t('coffee.compiling', { what: tool.summary || tool.tool })
    return { reason: 'compiling', toolUseId: tool.id, bubble }
  }

  /**
   * @param {CoffeeSituation} situation
   * @returns {CoffeeVisit | null}
   */
  #delegationVisit({ now, childCount, atCoffee }) {
    if (!this.#waitingSince) this.#waitingSince = now
    if (now - this.#waitingSince < DELEGATION_THRESHOLD_MS && !atCoffee) return null
    return { reason: 'delegated', bubble: this.#translator.t('coffee.supervising', { count: childCount }) }
  }

  /** @returns {null} */
  #stopWaiting() {
    this.#waitingSince = 0
    return null
  }
}
