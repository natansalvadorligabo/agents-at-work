/** An EventSource the test drives by hand. */
export class FakeEventSource {
  /** @type {Map<string, ((message: { data?: unknown }) => void)[]>} */
  #listeners = new Map()

  /** @param {string} type @param {(message: { data?: unknown }) => void} listener */
  addEventListener(type, listener) {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener])
  }

  /** @param {string} type @param {unknown} [data] */
  emit(type, data) {
    for (const listener of this.#listeners.get(type) ?? []) listener({ data })
  }
}
