import { CONTROL_KEY_HEADER, EventType, PermissionDecision, StreamMessage } from '#shared/protocol.js'
import { HttpError, parseJsonObject, requireString } from './http-error.js'
import { readHeader } from './request-guard.js'

/**
 * @typedef {import('#shared/protocol.js').OfficeEvent} OfficeEvent
 * @typedef {import('#shared/protocol.js').PermissionDecisionName} PermissionDecisionName
 * @typedef {import('./session-store.js').SessionStore} SessionStore
 * @typedef {import('./stream-hub.js').StreamHub} StreamHub
 * @typedef {import('./permission-desk.js').PermissionDesk} PermissionDesk
 * @typedef {import('./control-keys.js').ControlKeys} ControlKeys
 * @typedef {import('./request-guard.js').RequestHeaders} RequestHeaders
 *
 * @typedef {object} ControlDependencies
 * @property {SessionStore} store
 * @property {StreamHub} hub
 * @property {PermissionDesk} desk
 * @property {ControlKeys} keys
 * @property {() => number} now
 *
 * @typedef {{ status: number, body?: unknown }} ControlReply
 */

const DEFAULT_WAIT_MS = 25000

/**
 * Applies a server-raised event to the store and tells every open page.
 * @param {ControlDependencies} dependencies
 * @param {Omit<OfficeEvent, 'project' | 'timestamp'>} fields
 */
function publish({ store, hub, now }, fields) {
  const event = /** @type {OfficeEvent} */ ({ project: '', timestamp: now(), ...fields })
  const agent = store.apply(event)
  hub.broadcast(StreamMessage.UPDATE, { event, agent, session: store.info(event.sessionId) })
}

/**
 * POST /control/register — the hooks module hands over the session's control key.
 * @param {ControlDependencies} dependencies
 * @param {string} body
 * @returns {ControlReply}
 */
export function registerControlKey({ keys }, body) {
  const fields = parseJsonObject(body)
  try {
    keys.register(requireString(fields, 'sessionId'), fields.key)
  } catch (error) {
    throw error instanceof RangeError ? new HttpError(400, error.message) : error
  }
  return { status: 204 }
}

/**
 * POST /permissions — the hooks module asks the office; the agent raises its hand on every open page.
 * @param {ControlDependencies} dependencies
 * @param {string} body
 * @returns {ControlReply} How many pages are watching: with none, nobody can answer.
 */
export function openPermissionRequest(dependencies, body) {
  const fields = parseJsonObject(body)
  const sessionId = requireString(fields, 'sessionId')
  const agentId = requireString(fields, 'agentId')
  const requestId = requireString(fields, 'requestId')
  const text = (/** @type {string} */ field) =>
    typeof fields[field] === 'string' ? String(fields[field]) : ''
  dependencies.desk.open(requestId, { sessionId, agentId })
  publish(dependencies, {
    type: EventType.PERMISSION_REQUESTED,
    sessionId,
    agentId,
    requestId,
    tool: text('tool'),
    summary: text('summary'),
    reason: text('reason'),
  })
  return { status: 200, body: { watchers: dependencies.hub.subscriberCount } }
}

/**
 * GET /permissions/:id?waitMs= — long-polled by the hooks module until the page answers.
 * @param {ControlDependencies} dependencies
 * @param {string} requestId
 * @param {URL} url
 * @returns {Promise<ControlReply>}
 */
export async function awaitPermissionDecision({ desk, hub }, requestId, url) {
  const waitMs = Number(url.searchParams.get('waitMs')) || DEFAULT_WAIT_MS
  const decision = await desk.waitFor(requestId, waitMs)
  if (decision === PermissionDecision.ALLOW || decision === PermissionDecision.DENY) desk.close(requestId)
  return { status: 200, body: { decision, watchers: hub.subscriberCount } }
}

/**
 * DELETE /permissions/:id — the hooks module stopped waiting; the terminal dialog takes over.
 * @param {ControlDependencies} dependencies
 * @param {string} requestId
 * @returns {ControlReply}
 */
export function withdrawPermissionRequest(dependencies, requestId) {
  const owner = dependencies.desk.ownerOf(requestId)
  if (!owner) return { status: 204 }
  dependencies.desk.close(requestId)
  publish(dependencies, {
    type: EventType.PERMISSION_RESOLVED,
    ...owner,
    requestId,
    decision: PermissionDecision.EXPIRED,
  })
  return { status: 204 }
}

/**
 * POST /permissions/:id/decision — the office page answers; it must present the session's control key.
 * @param {ControlDependencies} dependencies
 * @param {string} requestId
 * @param {RequestHeaders} headers
 * @param {string} body
 * @returns {ControlReply}
 */
export function decidePermission(dependencies, requestId, headers, body) {
  const owner = dependencies.desk.ownerOf(requestId)
  if (!owner)
    throw new HttpError(
      404,
      `No open permission request ${JSON.stringify(requestId)}; expected one still waiting`,
    )
  if (!dependencies.keys.accepts(owner.sessionId, readHeader(headers, CONTROL_KEY_HEADER))) {
    throw new HttpError(
      403,
      `Missing or wrong control key; expected header ${CONTROL_KEY_HEADER} from the /office link`,
    )
  }
  const decision = parseFinalDecision(parseJsonObject(body).decision)
  if (!dependencies.desk.decide(requestId, decision))
    throw new HttpError(409, `Request ${requestId} was already answered`)
  publish(dependencies, { type: EventType.PERMISSION_RESOLVED, ...owner, requestId, decision })
  return { status: 204 }
}

/**
 * @param {unknown} value
 * @returns {'allow' | 'deny'}
 */
function parseFinalDecision(value) {
  if (value === PermissionDecision.ALLOW || value === PermissionDecision.DENY) return value
  throw new HttpError(400, `Decision is ${JSON.stringify(value)}; expected "allow" or "deny"`)
}
