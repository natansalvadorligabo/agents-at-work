import { timingSafeEqual } from 'node:crypto'

// The server listens on 127.0.0.1 only, but any web page the person visits can still send it requests.
// These checks keep other sites (and DNS-rebinding tricks) from reading the office or acting on a session.

/**
 * @typedef {Record<string, string | string[] | undefined>} RequestHeaders
 */

/**
 * @param {RequestHeaders} headers
 * @param {string} name
 * @returns {string | undefined}
 */
function header(headers, name) {
  const value = headers[name]
  return Array.isArray(value) ? value[0] : value
}

/**
 * Whether the Host header names this server on loopback. A rebinding attack reaches 127.0.0.1 under a
 * foreign host name, which this refuses.
 * @param {RequestHeaders} headers
 * @param {number} port
 * @returns {boolean}
 * @example isLoopbackHost({ host: '127.0.0.1:47821' }, 47821) // true
 */
export function isLoopbackHost(headers, port) {
  const host = header(headers, 'host')
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`
}

/**
 * Whether a browser request comes from the office page itself (or from no page at all).
 * @param {RequestHeaders} headers
 * @returns {boolean}
 * @example isSameOriginOrNone({ host: '127.0.0.1:47821', origin: 'https://evil.example' }) // false
 */
export function isSameOriginOrNone(headers) {
  const origin = header(headers, 'origin')
  return origin === undefined || origin === `http://${header(headers, 'host')}`
}

/**
 * Whether the request was made outside any browser, as the hooks module's requests are. Browsers stamp
 * `Sec-Fetch-Site` on every request and `Origin` on every POST, and pages cannot remove either. (Node's
 * fetch sends `Sec-Fetch-Mode` but neither of those, so only they tell the two apart.)
 * @param {RequestHeaders} headers
 * @returns {boolean}
 * @example isFromOutsideBrowser({ host: '127.0.0.1:47821' }) // true
 */
export function isFromOutsideBrowser(headers) {
  return header(headers, 'origin') === undefined && header(headers, 'sec-fetch-site') === undefined
}

/**
 * Compares a presented key with the expected one in constant time.
 * @param {string | undefined} presented
 * @param {string | undefined} expected
 * @returns {boolean}
 * @example keysMatch('abc', 'abc') // true
 */
export function keysMatch(presented, expected) {
  if (!presented || !expected) return false
  const [a, b] = [Buffer.from(presented), Buffer.from(expected)]
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * @param {RequestHeaders} headers
 * @param {string} name
 * @returns {string | undefined}
 */
export function readHeader(headers, name) {
  return header(headers, name)
}
