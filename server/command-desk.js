/**
 * @typedef {import('#shared/protocol.js').OfficeCommand} OfficeCommand
 * @typedef {import('#shared/protocol.js').CommandOutcome} CommandOutcome
 * @typedef {import('./permission-desk.js').Timeouts} Timeouts
 *
 * @typedef {object} PendingCommand
 * @property {string} sessionId
 * @property {OfficeCommand} command
 * @property {boolean} taken
 * @property {(outcome: CommandOutcome) => void} settle
 */

const MAX_WAIT_MS = 30000
/** How long the page waits for the session to pick a command up and say how it went. */
export const COMMAND_TIMEOUT_MS = 20000

export const NOT_PICKED_UP =
  'The session did not pick the command up; is Claude Code still running with the plugin loaded?'
export const NO_ANSWER = 'The session took the command but did not say how it went'

/**
 * Commands from the office page waiting for the session's hooks module. The page `submit`s and waits for
 * the outcome; the hooks module long-polls `take` and answers with `report`.
 * @example
 * const outcome = desk.submit('s1', { id: 'c1', kind: 'prompt', agentId: 'main', text: 'hi' })
 * await desk.take('s1', 25000) // [{ id: 'c1', ... }]
 * desk.report('c1', { ok: true }) // outcome resolves { ok: true }
 */
export class CommandDesk {
  /** @type {Map<string, PendingCommand>} */
  #commands = new Map()
  /** @type {Map<string, Set<() => void>>} */
  #takers = new Map()
  #timeouts

  /** @param {{ timeouts: Timeouts }} dependencies */
  constructor({ timeouts }) {
    this.#timeouts = timeouts
  }

  /**
   * Queues a command for the session; resolves with its outcome, or a failure after 20 s.
   * @param {string} sessionId
   * @param {OfficeCommand} command
   * @returns {Promise<CommandOutcome>}
   */
  submit(sessionId, command) {
    return new Promise(resolve => {
      /** @param {CommandOutcome} outcome */
      const settle = outcome => {
        cancel()
        this.#commands.delete(command.id)
        resolve(outcome)
      }
      const cancel = this.#timeouts.after(COMMAND_TIMEOUT_MS, () =>
        settle({ ok: false, error: pending.taken ? NO_ANSWER : NOT_PICKED_UP }),
      )
      /** @type {PendingCommand} */
      const pending = { sessionId, command, taken: false, settle }
      this.#commands.set(command.id, pending)
      for (const wake of [...(this.#takers.get(sessionId) ?? [])]) wake()
    })
  }

  /**
   * Hands over the session's commands not yet taken, waiting up to `waitMs` (capped at 30 s) for one.
   * @param {string} sessionId
   * @param {number} waitMs
   * @returns {Promise<OfficeCommand[]>}
   */
  async take(sessionId, waitMs) {
    if (!this.#hasWaiting(sessionId)) await this.#waitForCommand(sessionId, Math.min(waitMs, MAX_WAIT_MS))
    const taken = [...this.#commands.values()].filter(
      pending => pending.sessionId === sessionId && !pending.taken,
    )
    for (const pending of taken) pending.taken = true
    return taken.map(pending => pending.command)
  }

  /**
   * Passes the session's answer to the page waiting on the command.
   * @param {string} commandId
   * @param {CommandOutcome} outcome
   * @returns {boolean} False when the command is unknown (answered already or timed out).
   */
  report(commandId, outcome) {
    const pending = this.#commands.get(commandId)
    if (!pending) return false
    pending.settle(outcome)
    return true
  }

  /** @param {string} sessionId */
  #hasWaiting(sessionId) {
    return [...this.#commands.values()].some(pending => pending.sessionId === sessionId && !pending.taken)
  }

  /**
   * @param {string} sessionId
   * @param {number} waitMs
   * @returns {Promise<void>}
   */
  #waitForCommand(sessionId, waitMs) {
    const takers = this.#takers.get(sessionId) ?? new Set()
    this.#takers.set(sessionId, takers)
    return new Promise(resolve => {
      const wake = () => {
        cancel()
        takers.delete(wake)
        if (takers.size === 0) this.#takers.delete(sessionId)
        resolve()
      }
      const cancel = this.#timeouts.after(waitMs, wake)
      takers.add(wake)
    })
  }
}
