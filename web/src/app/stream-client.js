import { Route, StreamMessage } from '#shared/protocol.js'

/**
 * @typedef {import('#shared/protocol.js').SessionSnapshot} SessionSnapshot
 * @typedef {import('#shared/protocol.js').StreamUpdate} StreamUpdate
 *
 * The slice of `EventSource` the client listens on.
 * @typedef {object} EventStreamSource
 * @property {(type: string, listener: (message: { data?: unknown }) => void) => void} addEventListener
 *
 * @typedef {object} StreamHandlers
 * @property {(session: SessionSnapshot | null) => void} onSnapshot
 * @property {(update: StreamUpdate) => void} onUpdate
 * @property {(connected: boolean) => void} onConnectionChange
 */

/**
 * The stream URL, optionally pinned to one session.
 * @param {string | null} sessionId
 * @returns {string}
 * @example streamUrl('abc') // '/stream?session=abc'
 */
export function streamUrl(sessionId) {
  return sessionId ? `${Route.STREAM}?session=${encodeURIComponent(sessionId)}` : Route.STREAM
}

/**
 * Parses a stream message body.
 * @param {unknown} data
 * @returns {unknown}
 * @example parseStreamData('{"a":1}') // { a: 1 }
 */
export function parseStreamData(data) {
  if (typeof data !== 'string')
    throw new TypeError(`Stream message data is ${typeof data}; expected a JSON string`)
  try {
    return JSON.parse(data)
  } catch {
    throw new SyntaxError(
      `Stream message is not JSON: ${data.slice(0, 120)}; expected a snapshot or an update`,
    )
  }
}

/**
 * Subscribes to the office server's event stream. EventSource reconnects on its own after errors, and the
 * server answers every (re)connection with a fresh snapshot.
 * @param {EventStreamSource} source
 * @param {StreamHandlers} handlers
 * @example listenToStream(new EventSource(streamUrl(sessionId)), { onSnapshot, onUpdate, onConnectionChange })
 */
export function listenToStream(source, { onSnapshot, onUpdate, onConnectionChange }) {
  source.addEventListener('open', () => onConnectionChange(true))
  source.addEventListener('error', () => onConnectionChange(false))
  source.addEventListener(StreamMessage.SNAPSHOT, message =>
    onSnapshot(/** @type {SessionSnapshot | null} */ (parseStreamData(message.data))),
  )
  source.addEventListener(StreamMessage.UPDATE, message =>
    onUpdate(/** @type {StreamUpdate} */ (parseStreamData(message.data))),
  )
}
