import { CONTROL_KEY_PARAM } from '#shared/protocol.js'

/** @typedef {import('../i18n/locale-preference.js').KeyValueStorage} KeyValueStorage */

const STORAGE_PREFIX = 'agents-at-work.key.'

/**
 * Takes the session's control key out of the page address (so it does not linger in history, bookmarks
 * or screenshots) and keeps it in tab storage, so a reload still works.
 * @param {URL} url The page address; not modified.
 * @param {KeyValueStorage | null} storage Session storage; may be missing.
 * @returns {{ key: string | null, cleanUrl: string }}
 * @example takeControlKey(new URL('http://h/?session=s&key=k'), sessionStorage) // { key: 'k', cleanUrl: 'http://h/?session=s' }
 */
export function takeControlKey(url, storage) {
  const session = url.searchParams.get('session') ?? ''
  const fromUrl = url.searchParams.get(CONTROL_KEY_PARAM)
  const clean = new URL(url)
  clean.searchParams.delete(CONTROL_KEY_PARAM)
  if (fromUrl) safely(() => storage?.setItem(STORAGE_PREFIX + session, fromUrl))
  const key = fromUrl ?? safely(() => storage?.getItem(STORAGE_PREFIX + session) ?? null) ?? null
  return { key, cleanUrl: clean.toString() }
}

/**
 * Storage can throw (blocked site data); a missing key only disables the permission buttons.
 * @template T
 * @param {() => T} action
 * @returns {T | undefined}
 */
function safely(action) {
  try {
    return action()
  } catch {
    return undefined
  }
}
