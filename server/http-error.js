/**
 * An error that already knows its HTTP status; its message is sent to the client.
 * @example throw new HttpError(403, 'Missing control key; expected header x-agents-at-work-key')
 */
export class HttpError extends Error {
  name = 'HttpError'

  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * Parses a JSON request body that must be an object.
 * @param {string} body
 * @returns {Record<string, unknown>}
 * @example parseJsonObject('{"a":1}') // { a: 1 }
 */
export function parseJsonObject(body) {
  let value
  try {
    value = JSON.parse(body)
  } catch {
    throw new HttpError(400, `Body is not JSON: ${body.slice(0, 120)}; expected a JSON object`)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, `Body is ${JSON.stringify(value)}; expected a JSON object`)
  }
  return value
}

/**
 * Reads a required string field from a parsed body.
 * @param {Record<string, unknown>} body
 * @param {string} field
 * @returns {string}
 * @example requireString({ id: 'x' }, 'id') // 'x'
 */
export function requireString(body, field) {
  const value = body[field]
  if (typeof value === 'string' && value !== '') return value
  throw new HttpError(400, `Field ${field} is ${JSON.stringify(value)}; expected a non-empty string`)
}
