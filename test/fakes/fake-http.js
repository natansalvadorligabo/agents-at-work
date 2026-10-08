import { EventEmitter } from 'node:events'

/** Stands in for http.IncomingMessage: emits its body once `send` is called. */
export class FakeIncomingRequest extends EventEmitter {
  /** @param {{ method: string, url: string }} options */
  constructor({ method, url }) {
    super()
    this.method = method
    this.url = url
  }

  /** @param {string} body */
  send(body) {
    queueMicrotask(() => {
      this.emit('data', Buffer.from(body))
      this.emit('end')
    })
    return this
  }
}

/** Stands in for http.ServerResponse and records what was written. */
export class FakeServerResponse extends EventEmitter {
  statusCode = 0
  /** @type {Record<string, string>} */
  headers = {}
  headersSent = false
  /** @type {string[]} */
  chunks = []
  ended = false

  /** @param {number} status @param {Record<string, string>} [headers] */
  writeHead(status, headers = {}) {
    this.statusCode = status
    this.headers = headers
    this.headersSent = true
    return this
  }

  /** @param {string} chunk */
  write(chunk) {
    this.chunks.push(chunk)
    return true
  }

  /** @param {string | Uint8Array} [body] */
  end(body) {
    if (body !== undefined)
      this.chunks.push(typeof body === 'string' ? body : Buffer.from(body).toString('utf8'))
    this.ended = true
    return this
  }

  get body() {
    return this.chunks.join('')
  }
}
