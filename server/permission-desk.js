import { PermissionDecision } from '#shared/protocol.js'

/**
 * @typedef {import('#shared/protocol.js').PermissionDecisionName} PermissionDecisionName
 * @typedef {'allow' | 'deny'} FinalDecision
 *
 * @typedef {object} OpenRequest
 * @property {string} sessionId
 * @property {string} agentId
 * @property {FinalDecision | null} decision
 * @property {Set<(decision: PermissionDecisionName) => void>} waiters
 *
 * @typedef {object} Timeouts
 * @property {(ms: number, callback: () => void) => () => void} after Returns a function that cancels the timeout.
 */

const MAX_WAIT_MS = 30000

/**
 * Permission requests waiting for an answer from the office page. The hooks module long-polls `waitFor`;
 * the page answers with `decide`.
 * @example
 * desk.open('toolu_1', { sessionId: 's1', agentId: 'main' })
 * desk.decide('toolu_1', 'allow')
 * await desk.waitFor('toolu_1', 25000) // 'allow'
 */
export class PermissionDesk {
  /** @type {Map<string, OpenRequest>} */
  #requests = new Map()
  #timeouts

  /** @param {{ timeouts: Timeouts }} dependencies */
  constructor({ timeouts }) {
    this.#timeouts = timeouts
  }

  /**
   * @param {string} requestId
   * @param {{ sessionId: string, agentId: string }} owner
   */
  open(requestId, owner) {
    this.#requests.set(requestId, { ...owner, decision: null, waiters: new Set() })
  }

  /**
   * @param {string} requestId
   * @returns {{ sessionId: string, agentId: string } | null}
   */
  ownerOf(requestId) {
    const request = this.#requests.get(requestId)
    return request ? { sessionId: request.sessionId, agentId: request.agentId } : null
  }

  /**
   * Records the page's answer; the first answer wins.
   * @param {string} requestId
   * @param {FinalDecision} decision
   * @returns {boolean} False when the request is unknown or already answered.
   */
  decide(requestId, decision) {
    const request = this.#requests.get(requestId)
    if (!request || request.decision) return false
    request.decision = decision
    for (const wake of request.waiters) wake(decision)
    return true
  }

  /**
   * Resolves with the decision as soon as there is one, or `pending` after `waitMs` (capped at 30 s).
   * @param {string} requestId
   * @param {number} waitMs
   * @returns {Promise<PermissionDecisionName>}
   */
  waitFor(requestId, waitMs) {
    const request = this.#requests.get(requestId)
    if (!request) return Promise.resolve(PermissionDecision.EXPIRED)
    if (request.decision) return Promise.resolve(request.decision)
    return new Promise(resolve => {
      /** @param {PermissionDecisionName} decision */
      const wake = decision => {
        cancel()
        request.waiters.delete(wake)
        resolve(decision)
      }
      const cancel = this.#timeouts.after(Math.min(waitMs, MAX_WAIT_MS), () =>
        wake(PermissionDecision.PENDING),
      )
      request.waiters.add(wake)
    })
  }

  /**
   * Forgets a request (answered and consumed, or given up); pending waits resolve as expired.
   * @param {string} requestId
   */
  close(requestId) {
    const request = this.#requests.get(requestId)
    if (!request) return
    this.#requests.delete(requestId)
    for (const wake of request.waiters) wake(PermissionDecision.EXPIRED)
  }
}

/** @type {Timeouts} */
export const systemTimeouts = {
  after(ms, callback) {
    const handle = setTimeout(callback, ms)
    return () => clearTimeout(handle)
  },
}
