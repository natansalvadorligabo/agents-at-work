import { Route, StreamMessage } from '#shared/protocol.js'
import { EventValidationError, parseEventBatch } from './event-validation.js'

/**
 * @typedef {import('node:http').IncomingMessage} IncomingMessage
 * @typedef {import('node:http').ServerResponse} ServerResponse
 * @typedef {import('./session-store.js').SessionStore} SessionStore
 * @typedef {import('./stream-hub.js').StreamHub} StreamHub
 * @typedef {import('./static-files.js').StaticFiles} StaticFiles
 *
 * @typedef {object} AppDependencies
 * @property {SessionStore} store
 * @property {StreamHub} hub
 * @property {StaticFiles} staticFiles
 * @property {() => number} now
 * @property {(message: string) => void} logError
 */

/**
 * Builds the server's request listener: event intake, the live stream, health check and static files.
 * @param {AppDependencies} dependencies
 * @returns {(request: IncomingMessage, response: ServerResponse) => Promise<void>}
 * @example createServer(createRequestListener({ store, hub, staticFiles, now: Date.now, logError: console.error }))
 */
export function createRequestListener(dependencies) {
  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    try {
      await route(dependencies, request, response, url)
    } catch (error) {
      respondToFailure(dependencies, response, error)
    }
  }
}

/**
 * @param {AppDependencies} dependencies
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 * @param {URL} url
 * @returns {Promise<void>}
 */
async function route(dependencies, request, response, url) {
  if (request.method === 'POST' && url.pathname === Route.EVENTS)
    return receiveEvents(dependencies, request, response)
  if (url.pathname === Route.HEALTH) return void response.writeHead(200, JSON_HEADERS).end('{"ok":true}')
  if (url.pathname === Route.STREAM) return openStream(dependencies, response, url)
  if (request.method === 'GET') return serveFile(dependencies, response, url)
  response.writeHead(405).end()
}

const JSON_HEADERS = { 'content-type': 'application/json' }

/**
 * @param {AppDependencies} dependencies
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 */
async function receiveEvents({ store, hub, now }, request, response) {
  const events = parseEventBatch(await readBody(request), now)
  for (const event of events) {
    const agent = store.apply(event)
    hub.broadcast(StreamMessage.UPDATE, { event, agent, session: store.info(event.sessionId) })
  }
  response.writeHead(204).end()
}

/**
 * @param {AppDependencies} dependencies
 * @param {ServerResponse} response
 * @param {URL} url
 */
function openStream({ store, hub }, response, url) {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  hub.subscribe(response, StreamMessage.SNAPSHOT, store.snapshot(url.searchParams.get('session')))
}

/**
 * @param {AppDependencies} dependencies
 * @param {ServerResponse} response
 * @param {URL} url
 */
async function serveFile({ staticFiles }, response, url) {
  const file = await staticFiles.resolve(url.pathname)
  if (file.status !== 200) return void response.writeHead(file.status).end()
  response.writeHead(200, { 'content-type': file.contentType, 'cache-control': 'no-store' })
  response.end(file.body)
}

/**
 * @param {AppDependencies} dependencies
 * @param {ServerResponse} response
 * @param {unknown} error
 */
function respondToFailure({ logError }, response, error) {
  const message = error instanceof Error ? error.message : String(error)
  if (!(error instanceof EventValidationError)) logError(message)
  if (response.headersSent) return
  response
    .writeHead(error instanceof EventValidationError ? 400 : 500, { 'content-type': 'text/plain' })
    .end(message)
}

/**
 * @param {IncomingMessage} request
 * @returns {Promise<string>}
 */
function readBody(request) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}
