import { CONTROL_KEY_HEADER, Route } from '#shared/protocol.js'

/**
 * A command as the page sends it; the server adds the id.
 * @typedef {Omit<import('#shared/protocol.js').OfficeCommand, 'id'>} CommandRequest
 *
 * @typedef {(url: string, init: { method: string, headers: Record<string, string>, body: string }) => Promise<{ ok: boolean, status: number, text(): Promise<string> }>} FetchFunction
 */

/**
 * Sends the page's answers to the office server, signed with the session's control key.
 * @example
 * const control = new ControlClient({ fetch: window.fetch.bind(window), key })
 * await control.decidePermission('toolu_1', 'allow')
 */
export class ControlClient {
  #fetch
  #key
  #sessionId

  /** @param {{ fetch: FetchFunction, key: string | null, sessionId?: () => string | null }} dependencies */
  constructor({ fetch, key, sessionId = () => null }) {
    this.#fetch = fetch
    this.#key = key
    this.#sessionId = sessionId
  }

  /** Whether this page may answer at all (it was opened through /office). */
  get canDecide() {
    return this.#key !== null
  }

  /**
   * @param {string} requestId
   * @param {'allow' | 'deny'} decision
   * @returns {Promise<void>}
   */
  async decidePermission(requestId, decision) {
    if (this.#key === null) throw new Error('No control key; expected the page to be opened through /office')
    const response = await this.#fetch(`${Route.PERMISSIONS}/${encodeURIComponent(requestId)}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CONTROL_KEY_HEADER]: this.#key },
      body: JSON.stringify({ decision }),
    })
    if (!response.ok) throw new Error(`Server answered ${response.status}: ${await response.text()}`)
  }

  /**
   * Drives the session as the terminal would; resolves once the session took the command.
   * @param {CommandRequest} command
   * @returns {Promise<void>} Rejects with the session's reason when it could not.
   * @example await control.sendCommand({ kind: 'prompt', agentId: 'main', text: 'run the tests' })
   */
  async sendCommand(command) {
    if (this.#key === null) throw new Error('No control key; expected the page to be opened through /office')
    const sessionId = this.#sessionId()
    if (sessionId === null) throw new Error('No session on display yet')
    const response = await this.#fetch(Route.COMMANDS, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CONTROL_KEY_HEADER]: this.#key },
      body: JSON.stringify({ sessionId, ...command }),
    })
    if (response.ok) return
    const text = await response.text()
    throw new Error(reasonIn(text) ?? `Server answered ${response.status}: ${text}`)
  }
}

/**
 * The session's own words for a refused command, when the server passed them on.
 * @param {string} text
 * @returns {string | null}
 */
function reasonIn(text) {
  try {
    const body = JSON.parse(text)
    return typeof body?.error === 'string' ? body.error : null
  } catch {
    return null
  }
}
