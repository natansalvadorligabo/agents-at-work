import { EventType } from '#shared/protocol.js'

/** @typedef {import('#shared/protocol.js').OfficeEvent} OfficeEvent */

const KNOWN_TYPES = new Set(/** @type {string[]} */ (Object.values(EventType)))
const EXPECTED_SHAPE = `{ type: ${[...KNOWN_TYPES].join(' | ')}, sessionId: non-empty string, ... }`
const PREVIEW_LENGTH = 120

export class EventValidationError extends Error {
  name = 'EventValidationError'
}

/**
 * Parses a POST /events body into validated events; a single object counts as a batch of one.
 * @param {string} body
 * @param {() => number} now Fills `timestamp` when the sender omitted it.
 * @returns {OfficeEvent[]}
 * @example parseEventBatch('[{"type":"turn.start","sessionId":"s1"}]', Date.now)
 */
export function parseEventBatch(body, now) {
  const parsed = parseJson(body)
  const list = Array.isArray(parsed) ? parsed : [parsed]
  return list.map(value => validateEvent(value, now))
}

/**
 * Checks one event's shape and fills the optional envelope fields.
 * @param {unknown} value
 * @param {() => number} now
 * @returns {OfficeEvent}
 * @example validateEvent({ type: 'session.start', sessionId: 's1' }, Date.now).project // ''
 */
export function validateEvent(value, now) {
  if (!isRecord(value))
    throw new EventValidationError(
      `Event must be an object, got ${preview(value)}; expected ${EXPECTED_SHAPE}`,
    )
  if (typeof value.type !== 'string' || !KNOWN_TYPES.has(value.type)) {
    throw new EventValidationError(`Unknown event type ${preview(value.type)}; expected ${EXPECTED_SHAPE}`)
  }
  if (typeof value.sessionId !== 'string' || value.sessionId === '') {
    throw new EventValidationError(
      `Invalid sessionId ${preview(value.sessionId)}; expected ${EXPECTED_SHAPE}`,
    )
  }
  const event = /** @type {OfficeEvent} */ (
    /** @type {unknown} */ ({ project: '', timestamp: now(), ...value })
  )
  return event
}

/**
 * @param {string} body
 * @returns {unknown}
 */
function parseJson(body) {
  try {
    return JSON.parse(body)
  } catch {
    throw new EventValidationError(
      `Body is not JSON: ${preview(body)}; expected an event or an array of events`,
    )
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function preview(value) {
  const text = typeof value === 'string' ? JSON.stringify(value) : String(JSON.stringify(value))
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text
}
