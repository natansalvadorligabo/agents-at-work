import { DEFAULT_PORT, Route } from '../../shared/protocol.js'

export const OFFICE_URL = `http://127.0.0.1:${DEFAULT_PORT}`
export const HEALTH_URL = `${OFFICE_URL}${Route.HEALTH}`
export const EVENTS_URL = `${OFFICE_URL}${Route.EVENTS}`
export const SERVER_PORT_ENV = 'AGENTS_AT_WORK_PORT'

/**
 * Builds the address that opens the office for one session.
 * @example officePageUrl('abc 1') // 'http://127.0.0.1:47821/?session=abc%201'
 */
export function officePageUrl(sessionId: string): string {
  return `${OFFICE_URL}/?session=${encodeURIComponent(sessionId)}`
}

/**
 * The command lines that open a URL in the default browser on Windows, macOS and Linux, in the order to try them.
 * @example browserOpenCommands('http://x')[0] // ['cmd', '/c', 'start', '', 'http://x']
 */
export function browserOpenCommands(url: string): string[][] {
  // "start" is a cmd builtin; its empty first argument is the window title, so the URL is not read as one.
  return [
    ['cmd', '/c', 'start', '', url],
    ['open', url],
    ['xdg-open', url],
  ]
}
