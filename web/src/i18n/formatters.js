/** @typedef {import('./translator.js').LocaleCode} LocaleCode */

/**
 * Formats a coffee-ish duration as "45s" or "1m05s"; compact enough for a ranking row.
 * @param {number} milliseconds
 * @returns {string}
 * @example formatShortDuration(65000) // '1m05s'
 */
export function formatShortDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}

/**
 * Formats a tool call's duration, using the locale's decimal separator.
 * @param {number} milliseconds
 * @param {LocaleCode} locale
 * @returns {string}
 * @example formatToolDuration(1500, 'pt-BR') // '1,5 s'
 */
export function formatToolDuration(milliseconds, locale) {
  if (milliseconds < 1000) return `${milliseconds} ms`
  const seconds = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${seconds.format(milliseconds / 1000)} s`
}

/**
 * Formats an epoch timestamp as a time of day; empty when there is no timestamp.
 * @param {number | null | undefined} timestamp
 * @param {LocaleCode} locale
 * @returns {string}
 * @example formatTimeOfDay(Date.now(), 'en') // '9:41:07 PM'
 */
export function formatTimeOfDay(timestamp, locale) {
  return timestamp ? new Date(timestamp).toLocaleTimeString(locale) : ''
}
