import { Route, StreamMessage } from '#shared/protocol.js'
import {
  awaitPermissionDecision,
  decidePermission,
  openPermissionRequest,
  registerControlKey,
  reportCommandResult,
  submitCommand,
  takeCommands,
  withdrawPermissionRequest,
} from './control-routes.js'
import { EventValidationError, parseEventBatch } from './event-validation.js'
import { HttpError } from './http-error.js'
import { isFromOutsideBrowser, isLoopbackHost, isSameOriginOrNone } from './request-guard.js'

/**
 * @typedef {import('node:http').IncomingMessage} IncomingMessage
 * @typedef {import('node:http').ServerResponse} ServerResponse
 * @typedef {import('./session-store.js').SessionStore} SessionStore
 * @typedef {import('./stream-hub.js').StreamHub} StreamHub
 * @typedef {import('./static-files.js').StaticFiles} StaticFiles
 * @typedef {import('./control-routes.js').ControlDependencies} ControlDependencies
 * @typedef {import('./control-routes.js').ControlReply} ControlReply
 *
 * @typedef {ControlDependencies & {
 *   staticFiles: StaticFiles,
 *   port: number,
 *   logError: (message: string) => void,
 * }} AppDependencies
 *
 * @typedef {{ dependencies: AppDependencies, request: IncomingMessage, response: ServerResponse, url: URL }} Exchange
 */

const JSON_HEADERS = { 'content-type': 'application/json' }
const PERMISSION_PATH = /^\/permissions\/([\w.-]+)(\/decision)?$/
const COMMAND_RESULT_PATH = /^\/commands\/([\w.-]+)\/result$/

/**
 * Builds the server's request listener: event intake, the live stream, permissions, health check and
 * static files, behind the loopback and same-origin checks.
 * @param {AppDependencies} dependencies
 * @returns {(request: IncomingMessage, response: ServerResponse) => Promise<void>}
 * @example createServer(createRequestListener({ store, hub, desk, keys, staticFiles, port, now: Date.now, logError }))
 */
export function createRequestListener(dependencies) {
  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    try {
      guard(dependencies, request)
      await route({ dependencies, request, response, url })
    } catch (error) {
      respondToFailure(dependencies, response, error)
    }
  }
}

/**
 * @param {AppDependencies} dependencies
 * @param {IncomingMessage} request
 */
function guard({ port }, request) {
  if (!isLoopbackHost(request.headers, port)) {
    throw new HttpError(
      403,
      `Host ${JSON.stringify(request.headers.host)} refused; expected 127.0.0.1:${port}`,
    )
  }
  if (!isSameOriginOrNone(request.headers)) {
    throw new HttpError(
      403,
      `Origin ${JSON.stringify(request.headers.origin)} refused; expected this server's own page`,
    )
  }
}

/**
 * Routes only the hooks module may call (it runs outside any browser).
 * @param {IncomingMessage} request
 */
function requireOutsideBrowser(request) {
  if (!isFromOutsideBrowser(request.headers)) {
    throw new HttpError(
      403,
      `${request.method} ${request.url} is reserved for the plugin; browsers may not call it`,
    )
  }
}

/**
 * @param {Exchange} exchange
 * @returns {Promise<void>}
 */
async function route(exchange) {
  const { request, response, url } = exchange
  const permission = PERMISSION_PATH.exec(url.pathname)
  if (permission)
    return reply(response, await routePermission(exchange, permission[1] ?? '', Boolean(permission[2])))
  if (url.pathname === Route.COMMANDS || COMMAND_RESULT_PATH.test(url.pathname))
    return reply(response, await routeCommand(exchange))
  if (request.method === 'POST') return routePost(exchange)
  if (url.pathname === Route.HEALTH) return void response.writeHead(200, JSON_HEADERS).end('{"ok":true}')
  if (url.pathname === Route.STREAM) return openStream(exchange)
  if (request.method === 'GET') return serveFile(exchange)
  throw new HttpError(405, `${request.method} ${url.pathname} is not supported`)
}

/**
 * @param {Exchange} exchange
 * @returns {Promise<void>}
 */
async function routePost({ dependencies, request, response, url }) {
  requireOutsideBrowser(request)
  const body = await readBody(request)
  if (url.pathname === Route.EVENTS) return reply(response, receiveEvents(dependencies, body))
  if (url.pathname === Route.CONTROL_REGISTER) return reply(response, registerControlKey(dependencies, body))
  if (url.pathname === Route.PERMISSIONS) return reply(response, openPermissionRequest(dependencies, body))
  throw new HttpError(
    404,
    `POST ${url.pathname} is not a route; expected ${Route.EVENTS}, ${Route.PERMISSIONS} or ${Route.CONTROL_REGISTER}`,
  )
}

/**
 * @param {Exchange} exchange
 * @param {string} requestId
 * @param {boolean} isDecision
 * @returns {Promise<ControlReply>}
 */
async function routePermission({ dependencies, request, url }, requestId, isDecision) {
  if (isDecision && request.method === 'POST') {
    return decidePermission(dependencies, requestId, request.headers, await readBody(request))
  }
  requireOutsideBrowser(request)
  if (request.method === 'GET') return awaitPermissionDecision(dependencies, requestId, url)
  if (request.method === 'DELETE') return withdrawPermissionRequest(dependencies, requestId)
  throw new HttpError(405, `${request.method} ${url.pathname} is not supported`)
}

/**
 * The page posts commands (with the control key); the hooks module long-polls them and reports results.
 * @param {Exchange} exchange
 * @returns {Promise<ControlReply>}
 */
async function routeCommand({ dependencies, request, url }) {
  if (url.pathname === Route.COMMANDS && request.method === 'POST') {
    return submitCommand(dependencies, request.headers, await readBody(request))
  }
  requireOutsideBrowser(request)
  if (url.pathname === Route.COMMANDS && request.method === 'GET') return takeCommands(dependencies, url)
  const result = COMMAND_RESULT_PATH.exec(url.pathname)
  if (result && request.method === 'POST')
    return reportCommandResult(dependencies, result[1] ?? '', await readBody(request))
  throw new HttpError(405, `${request.method} ${url.pathname} is not supported`)
}

/**
 * @param {AppDependencies} dependencies
 * @param {string} body
 * @returns {ControlReply}
 */
function receiveEvents({ store, hub, now }, body) {
  for (const event of parseEventBatch(body, now)) {
    const agent = store.apply(event)
    hub.broadcast(StreamMessage.UPDATE, { event, agent, session: store.info(event.sessionId) })
  }
  return { status: 204 }
}

/** @param {Exchange} exchange */
function openStream({ dependencies, response, url }) {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  const snapshot = dependencies.store.snapshot(url.searchParams.get('session'))
  dependencies.hub.subscribe(response, StreamMessage.SNAPSHOT, snapshot)
}

/** @param {Exchange} exchange */
async function serveFile({ dependencies, response, url }) {
  const file = await dependencies.staticFiles.resolve(url.pathname)
  if (file.status !== 200) return void response.writeHead(file.status).end()
  response.writeHead(200, { 'content-type': file.contentType, 'cache-control': 'no-store' })
  response.end(file.body)
}

/**
 * @param {ServerResponse} response
 * @param {ControlReply} result
 */
function reply(response, { status, body }) {
  if (body === undefined) return void response.writeHead(status).end()
  response.writeHead(status, JSON_HEADERS).end(JSON.stringify(body))
}

/**
 * @param {AppDependencies} dependencies
 * @param {ServerResponse} response
 * @param {unknown} error
 */
function respondToFailure({ logError }, response, error) {
  const message = error instanceof Error ? error.message : String(error)
  const status = error instanceof HttpError ? error.status : error instanceof EventValidationError ? 400 : 500
  if (status === 500) logError(message)
  if (response.headersSent) return
  response.writeHead(status, { 'content-type': 'text/plain' }).end(message)
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
