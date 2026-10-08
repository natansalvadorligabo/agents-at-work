/** In-memory Storage; `broken` makes every access throw like a blocked localStorage. */
export class FakeStorage {
  /** @type {Map<string, string>} */
  items = new Map()
  broken = false

  /** @param {string} key */
  getItem(key) {
    if (this.broken) throw new Error('SecurityError')
    return this.items.get(key) ?? null
  }

  /** @param {string} key @param {string} value */
  setItem(key, value) {
    if (this.broken) throw new Error('SecurityError')
    this.items.set(key, value)
  }
}
