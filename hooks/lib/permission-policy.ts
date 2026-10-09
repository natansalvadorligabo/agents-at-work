import { PermissionDecision } from '../../shared/protocol.js'

/** How long a tool call may wait for an answer on the web before the terminal dialog takes over. */
export const WEB_APPROVAL_WINDOW_MS = 60_000
/** How long each long-poll to the office server may hang. */
export const POLL_WAIT_MS = 25_000

// The engine only lets a hook tighten these: its `allow` would not dismiss the person's dialog.
const PERSON_ONLY_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode'])
// A subagent hands its report back through this; only the auto-mode classifier may allow it, so an allow
// from the office is refused and the report never arrives.
const ENGINE_ONLY_TOOLS = new Set(['SubagentHandback'])

export type FinalDecision = 'allow' | 'deny'

/**
 * Whether a permission verdict should be offered to the office page instead of the terminal dialog.
 * Only real calls (with a tool_use_id) that the engine would ask about qualify.
 * @example shouldAskOffice('ask', 'Bash', 'toolu_1') // true
 */
export function shouldAskOffice(decision: string, tool: string, toolUseId: string | undefined): boolean {
  return (
    decision === 'ask' &&
    toolUseId !== undefined &&
    !PERSON_ONLY_TOOLS.has(tool) &&
    !ENGINE_ONLY_TOOLS.has(tool)
  )
}

/**
 * Reads the office server's answer to a long-poll.
 * @returns the final decision, `wait` to poll again, or `give-up` to fall back to the terminal.
 * @example readPollAnswer('{"decision":"allow","watchers":1}') // 'allow'
 */
export function readPollAnswer(text: string): FinalDecision | 'wait' | 'give-up' {
  const answer = parseAnswer(text)
  if (answer.decision === PermissionDecision.ALLOW || answer.decision === PermissionDecision.DENY)
    return answer.decision
  if (answer.decision === PermissionDecision.PENDING && answer.watchers > 0) return 'wait'
  return 'give-up'
}

/**
 * Reads how many office pages are open from the reply to a new permission request.
 * @example watchersOf('{"watchers":2}') // 2
 */
export function watchersOf(text: string): number {
  return parseAnswer(text).watchers
}

/**
 * Generates a session's control key: 256 random bits as hex.
 * @example createControlKey(crypto).length // 64
 */
export function createControlKey(random: {
  getRandomValues<T extends ArrayBufferView>(array: T): T
}): string {
  const bytes = random.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function parseAnswer(text: string): { decision: string; watchers: number } {
  try {
    const value = JSON.parse(text) as { decision?: unknown; watchers?: unknown }
    const watchers = typeof value.watchers === 'number' ? value.watchers : 0
    return { decision: typeof value.decision === 'string' ? value.decision : '', watchers }
  } catch {
    return { decision: '', watchers: 0 }
  }
}
