import { CONTROL_KEY_HEADER, Route } from '#shared/protocol.js'

/**
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

  /** @param {{ fetch: FetchFunction, key: string | null }} dependencies */
  constructor({ fetch, key }) {
    this.#fetch = fetch
    this.#key = key
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
}
