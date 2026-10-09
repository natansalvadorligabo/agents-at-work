import { CommandKind, MAIN_AGENT_ID } from '../../shared/protocol.js'

/** How long each long-poll for the office page's commands may hang. */
export const COMMAND_POLL_WAIT_MS = 25_000
/** How long to wait before polling again when the office server is not answering. */
export const COMMAND_RETRY_MS = 5_000

export type OfficeCommand =
  | { id: string; kind: 'prompt'; agentId: string; text: string }
  | { id: string; kind: 'message'; agentId: string; text: string }
  | { id: string; kind: 'stop'; agentId: string }
  | { id: string; kind: 'spawn'; agentId: string; text: string; description: string; subagentType: string }

export type CommandOutcome = { ok: true } | { ok: false; error: string }

const KINDS: ReadonlySet<string> = new Set(Object.values(CommandKind))

/**
 * Reads the office server's answer to a commands long-poll, skipping anything malformed.
 * @example readCommands('{"commands":[{"id":"c1","kind":"stop","agentId":"main"}]}') // [{ id: 'c1', kind: 'stop', agentId: 'main' }]
 */
export function readCommands(text: string): OfficeCommand[] {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return []
  }
  const list = (value as { commands?: unknown } | null)?.commands
  return Array.isArray(list) ? list.filter(isCommand) : []
}

function isCommand(value: unknown): value is OfficeCommand {
  if (typeof value !== 'object' || value === null) return false
  const command = value as Record<string, unknown>
  const strings = (...fields: string[]) => fields.every(field => typeof command[field] === 'string')
  if (!strings('id', 'kind', 'agentId') || !KINDS.has(String(command.kind))) return false
  if (command.kind === CommandKind.STOP) return true
  if (command.kind === CommandKind.SPAWN) return strings('text', 'description', 'subagentType')
  return strings('text')
}

/**
 * The model turn each agent is running, so the office can stop it by agent: `turn.start` and
 * `turn.step` say when one runs, `turn.complete` when it is over.
 * @example
 * turns.started('main', 'turn_1')
 * turns.of('main') // 'turn_1'
 */
export class RunningTurns {
  readonly #turns = new Map<string, string>()

  started(agentId: string | undefined, turnId: string): void {
    this.#turns.set(agentId ?? MAIN_AGENT_ID, turnId)
  }

  ended(agentId: string | undefined, turnId: string): void {
    const key = agentId ?? MAIN_AGENT_ID
    if (this.#turns.get(key) === turnId) this.#turns.delete(key)
  }

  of(agentId: string): string | undefined {
    return this.#turns.get(agentId)
  }
}

/**
 * Words an engine refusal for the person reading the office page.
 * @example failure(new Error('boom')) // { ok: false, error: 'boom' }
 */
export function failure(error: unknown): CommandOutcome {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}
