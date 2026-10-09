import {
  CONTROL_KEY_HEADER,
  CommandKind,
  EventType,
  MAIN_AGENT_ID,
  PermissionDecision,
  StreamMessage,
} from '#shared/protocol.js'
import { HttpError, parseJsonObject, requireString } from './http-error.js'
import { NOT_PICKED_UP } from './command-desk.js'
import { readHeader } from './request-guard.js'

/**
 * @typedef {import('#shared/protocol.js').OfficeEvent} OfficeEvent
 * @typedef {import('#shared/protocol.js').PermissionDecisionName} PermissionDecisionName
 * @typedef {import('./session-store.js').SessionStore} SessionStore
 * @typedef {import('./stream-hub.js').StreamHub} StreamHub
 * @typedef {import('./permission-desk.js').PermissionDesk} PermissionDesk
 * @typedef {import('./control-keys.js').ControlKeys} ControlKeys
 * @typedef {import('./command-desk.js').CommandDesk} CommandDesk
 * @typedef {import('#shared/protocol.js').OfficeCommand} OfficeCommand
 * @typedef {import('#shared/protocol.js').CommandKindName} CommandKindName
 * @typedef {import('./request-guard.js').RequestHeaders} RequestHeaders
 *
 * @typedef {object} ControlDependencies
 * @property {SessionStore} store
 * @property {StreamHub} hub
 * @property {PermissionDesk} desk
 * @property {ControlKeys} keys
 * @property {CommandDesk} commands
 * @property {() => string} newId Mints command ids.
 * @property {() => number} now
 *
 * @typedef {{ status: number, body?: unknown }} ControlReply
 */

const DEFAULT_WAIT_MS = 25000
const MAX_TEXT_LENGTH = 100_000
const DEFAULT_SUBAGENT_TYPE = 'general-purpose'
const DESCRIPTION_LENGTH = 40
const COMMAND_KINDS = new Set(Object.values(CommandKind))

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
  requireControlKey(dependencies, owner.sessionId, headers)
  const decision = parseFinalDecision(parseJsonObject(body).decision)
  if (!dependencies.desk.decide(requestId, decision))
    throw new HttpError(409, `Request ${requestId} was already answered`)
  publish(dependencies, { type: EventType.PERMISSION_RESOLVED, ...owner, requestId, decision })
  return { status: 204 }
}

/**
 * Refuses a request that does not carry the session's control key.
 * @param {ControlDependencies} dependencies
 * @param {string} sessionId
 * @param {RequestHeaders} headers
 */
function requireControlKey({ keys }, sessionId, headers) {
  if (!keys.accepts(sessionId, readHeader(headers, CONTROL_KEY_HEADER))) {
    throw new HttpError(
      403,
      `Missing or wrong control key; expected header ${CONTROL_KEY_HEADER} from the /office link`,
    )
  }
}

/**
 * POST /commands — the office page drives the session; answers once the session says how it went.
 * @param {ControlDependencies} dependencies
 * @param {RequestHeaders} headers
 * @param {string} body
 * @returns {Promise<ControlReply>} 200 with `{ ok: true }`, or 422 / 504 with `{ ok: false, error }`.
 */
export async function submitCommand(dependencies, headers, body) {
  const fields = parseJsonObject(body)
  const sessionId = requireString(fields, 'sessionId')
  requireControlKey(dependencies, sessionId, headers)
  const command = parseCommand(fields, dependencies.newId())
  const outcome = await dependencies.commands.submit(sessionId, command)
  if (outcome.ok) return { status: 200, body: outcome }
  return { status: outcome.error === NOT_PICKED_UP ? 504 : 422, body: outcome }
}

/**
 * GET /commands?session=&waitMs= — long-polled by the hooks module for the page's commands.
 * @param {ControlDependencies} dependencies
 * @param {URL} url
 * @returns {Promise<ControlReply>}
 */
export async function takeCommands({ commands }, url) {
  const sessionId = url.searchParams.get('session')
  if (!sessionId) throw new HttpError(400, 'Query parameter session is missing; expected the session id')
  const waitMs = Number(url.searchParams.get('waitMs')) || DEFAULT_WAIT_MS
  return { status: 200, body: { commands: await commands.take(sessionId, waitMs) } }
}

/**
 * POST /commands/:id/result — the hooks module says how a command went.
 * @param {ControlDependencies} dependencies
 * @param {string} commandId
 * @param {string} body
 * @returns {ControlReply}
 */
export function reportCommandResult({ commands }, commandId, body) {
  const fields = parseJsonObject(body)
  commands.report(
    commandId,
    fields.ok === true ? { ok: true } : { ok: false, error: String(fields.error ?? 'failed') },
  )
  return { status: 204 }
}

/**
 * @param {Record<string, unknown>} fields
 * @param {string} id
 * @returns {OfficeCommand}
 */
function parseCommand(fields, id) {
  const kind = /** @type {CommandKindName} */ (requireString(fields, 'kind'))
  if (!COMMAND_KINDS.has(kind)) {
    throw new HttpError(
      400,
      `Kind ${JSON.stringify(kind)} unknown; expected one of ${[...COMMAND_KINDS].join(', ')}`,
    )
  }
  const agentId = requireString(fields, 'agentId')
  const isMain = agentId === MAIN_AGENT_ID
  if ((kind === CommandKind.PROMPT || kind === CommandKind.SPAWN) && !isMain)
    throw new HttpError(400, `Kind ${kind} goes to the main agent; got agent ${JSON.stringify(agentId)}`)
  if (kind === CommandKind.MESSAGE && isMain)
    throw new HttpError(400, 'Kind message goes to a subagent; use kind prompt for the main agent')
  if (kind === CommandKind.STOP) return { id, kind, agentId }
  const text = requireText(fields, 'text')
  if (kind !== CommandKind.SPAWN) return { id, kind, agentId, text }
  return {
    id,
    kind,
    agentId,
    text,
    description: optionalText(fields, 'description') ?? text.slice(0, DESCRIPTION_LENGTH),
    subagentType: optionalText(fields, 'subagentType') ?? DEFAULT_SUBAGENT_TYPE,
  }
}

/**
 * @param {Record<string, unknown>} fields
 * @param {string} field
 * @returns {string}
 */
function requireText(fields, field) {
  const text = optionalText(fields, field)
  if (text === undefined) throw new HttpError(400, `Field ${field} is empty; expected some text`)
  if (text.length > MAX_TEXT_LENGTH) {
    throw new HttpError(
      400,
      `Field ${field} has ${text.length} characters; expected at most ${MAX_TEXT_LENGTH}`,
    )
  }
  return text
}

/**
 * @param {Record<string, unknown>} fields
 * @param {string} field
 * @returns {string | undefined}
 */
function optionalText(fields, field) {
  const value = fields[field]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/**
 * @param {unknown} value
 * @returns {'allow' | 'deny'}
 */
function parseFinalDecision(value) {
  if (value === PermissionDecision.ALLOW || value === PermissionDecision.DENY) return value
  throw new HttpError(400, `Decision is ${JSON.stringify(value)}; expected "allow" or "deny"`)
}
