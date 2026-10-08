/** Just enough of an HTMLElement for the UI classes: classes, attributes, text, html and clicks. */
export class FakeElement {
  textContent = ''
  innerHTML = ''
  /** @type {Map<string, string>} */
  attributes = new Map()
  /** @type {Map<string, ((event: { target: unknown }) => void)[]>} */
  listeners = new Map()
  /** @type {Set<string>} */
  classes = new Set()

  classList = {
    add: (/** @type {string} */ name) => void this.classes.add(name),
    remove: (/** @type {string} */ name) => void this.classes.delete(name),
    contains: (/** @type {string} */ name) => this.classes.has(name),
    toggle: (/** @type {string} */ name, /** @type {boolean} */ force) => {
      if (force) this.classes.add(name)
      else this.classes.delete(name)
      return force
    },
  }

  /** @param {string} name @param {string} value */
  setAttribute(name, value) {
    this.attributes.set(name, value)
  }

  /** @param {string} name */
  getAttribute(name) {
    return this.attributes.get(name) ?? null
  }

  /** @param {string} type @param {(event: { target: unknown }) => void} listener */
  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  /** @param {unknown} target */
  click(target) {
    for (const listener of this.listeners.get('click') ?? []) listener({ target })
  }

  querySelector() {
    return null
  }
}

/** A click target whose `closest` matches exactly one selector. */
export class FakeClickTarget {
  /** @param {string} matchingSelector @param {Record<string, string>} [dataset] */
  constructor(matchingSelector, dataset = {}) {
    this.matchingSelector = matchingSelector
    this.dataset = dataset
  }

  /** @param {string} selector */
  closest(selector) {
    return selector === this.matchingSelector ? this : null
  }
}

/** A document with a few elements, for code that walks `[data-i18n]` attributes. */
export class FakeDocument {
  title = ''
  documentElement = { lang: '' }

  /** @param {FakeElement[]} elements */
  constructor(elements) {
    this.elements = elements
  }

  /** @param {string} selector e.g. "[data-i18n]" or "[data-i18n-title]" */
  querySelectorAll(selector) {
    const attribute = selector.slice(1, -1)
    return this.elements.filter(element => element.getAttribute(attribute) !== null)
  }
}
