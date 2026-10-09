import { CONTROL_KEY_PARAM, DEFAULT_PORT, Route } from '../../shared/protocol.js'

export const OFFICE_URL = `http://127.0.0.1:${DEFAULT_PORT}`
export const HEALTH_URL = `${OFFICE_URL}${Route.HEALTH}`
export const EVENTS_URL = `${OFFICE_URL}${Route.EVENTS}`
export const CONTROL_REGISTER_URL = `${OFFICE_URL}${Route.CONTROL_REGISTER}`
export const PERMISSIONS_URL = `${OFFICE_URL}${Route.PERMISSIONS}`
export const COMMANDS_URL = `${OFFICE_URL}${Route.COMMANDS}`
export const SERVER_PORT_ENV = 'AGENTS_AT_WORK_PORT'

/**
 * Builds the address that opens the office for one session, carrying the key that lets the page act on it.
 * @example officePageUrl('abc 1', 'k') // 'http://127.0.0.1:47821/?session=abc%201&key=k'
 */
export function officePageUrl(sessionId: string, controlKey: string): string {
  const query = new URLSearchParams({ session: sessionId, [CONTROL_KEY_PARAM]: controlKey })
  return `${OFFICE_URL}/?${query.toString().replace(/\+/g, '%20')}`
}

/**
 * The long-poll address for one permission request.
 * @example permissionUrl('toolu_1', 25000) // 'http://127.0.0.1:47821/permissions/toolu_1?waitMs=25000'
 */
export function permissionUrl(requestId: string, waitMs?: number): string {
  const wait = waitMs === undefined ? '' : `?waitMs=${waitMs}`
  return `${PERMISSIONS_URL}/${encodeURIComponent(requestId)}${wait}`
}

/**
 * The long-poll address for the office page's commands to one session.
 * @example commandsUrl('s 1', 25000) // 'http://127.0.0.1:47821/commands?session=s%201&waitMs=25000'
 */
export function commandsUrl(sessionId: string, waitMs: number): string {
  const query = new URLSearchParams({ session: sessionId, waitMs: String(waitMs) })
  return `${COMMANDS_URL}?${query.toString().replace(/\+/g, '%20')}`
}

/**
 * Where the hooks module says how one command went.
 * @example commandResultUrl('c1') // 'http://127.0.0.1:47821/commands/c1/result'
 */
export function commandResultUrl(commandId: string): string {
  return `${COMMANDS_URL}/${encodeURIComponent(commandId)}/result`
}

/**
 * The command lines that open a URL in the default browser on Windows, macOS and Linux, in the order to try them.
 * @example browserOpenCommands('http://x')[0] // ['rundll32', 'url.dll,FileProtocolHandler', 'http://x']
 */
export function browserOpenCommands(url: string): string[][] {
  // Not `cmd /c start`: cmd reads the `&` between query parameters as a command separator.
  return [
    ['rundll32', 'url.dll,FileProtocolHandler', url],
    ['open', url],
    ['xdg-open', url],
  ]
}
