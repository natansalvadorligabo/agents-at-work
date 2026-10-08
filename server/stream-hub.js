/**
 * @typedef {object} StreamResponse The slice of `http.ServerResponse` the hub writes to.
 * @property {(chunk: string) => unknown} write
 * @property {(event: 'close', listener: () => void) => unknown} on
 *
 * @typedef {import('#shared/interval-timer.js').IntervalTimer} IntervalTimer
 */

const KEEP_ALIVE_MS = 15000
const KEEP_ALIVE_COMMENT = ': alive\n\n'

/**
 * Formats one server-sent event frame.
 * @param {string} name
 * @param {unknown} payload
 * @returns {string}
 * @example formatServerSentEvent('update', { a: 1 }) // 'event: update\ndata: {"a":1}\n\n'
 */
export function formatServerSentEvent(name, payload) {
  return `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`
}

/**
 * Fans server-sent events out to every open browser tab.
 * @example
 * const hub = new StreamHub({ timer: nodeIntervalTimer })
 * hub.subscribe(response, 'snapshot', null)
 * hub.broadcast('update', { event })
 */
export class StreamHub {
  /** @type {Set<StreamResponse>} */
  #subscribers = new Set()
  #timer

  /** @param {{ timer: IntervalTimer }} dependencies */
  constructor({ timer }) {
    this.#timer = timer
  }

  get subscriberCount() {
    return this.#subscribers.size
  }

  /**
   * Sends the initial message and keeps the connection open until the client goes away.
   * @param {StreamResponse} response
   * @param {string} initialName
   * @param {unknown} initialPayload
   */
  subscribe(response, initialName, initialPayload) {
    response.write(formatServerSentEvent(initialName, initialPayload))
    this.#subscribers.add(response)
    // Proxies and browsers drop idle event streams; a comment line keeps them open.
    const cancelKeepAlive = this.#timer.every(KEEP_ALIVE_MS, () => response.write(KEEP_ALIVE_COMMENT))
    response.on('close', () => {
      cancelKeepAlive()
      this.#subscribers.delete(response)
    })
  }

  /**
   * @param {string} name
   * @param {unknown} payload
   */
  broadcast(name, payload) {
    const frame = formatServerSentEvent(name, payload)
    for (const subscriber of this.#subscribers) subscriber.write(frame)
  }
}
