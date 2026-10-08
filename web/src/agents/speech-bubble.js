/**
 * @typedef {import('../core/clock.js').Clock} Clock
 *
 * A text element floating over the 3D scene, implemented by the DOM overlay (or a fake in tests).
 * @typedef {object} OverlayLabel
 * @property {(text: string) => void} setText
 * @property {(html: string) => void} setHtml Callers escape untrusted parts themselves.
 * @property {(visible: boolean) => void} setVisible
 * @property {(x: number, y: number, opacity: number) => void} place Screen pixels; anchored at its bottom center.
 * @property {() => void} remove
 *
 * @typedef {object} LabelLayer
 * @property {(kind: 'nameplate' | 'bubble', isMainAgent: boolean) => OverlayLabel} createLabel
 *
 * @typedef {{ durationMs?: number, priority?: boolean }} BubbleOptions
 */

/**
 * An agent's speech bubble. Status lines are re-sent every frame, so a priority line (a delivery, a joke)
 * must survive those updates until it expires.
 * @example
 * bubble.show('👍 Got it', { durationMs: 1200, priority: true })
 * bubble.show('📚 Read app.ts') // ignored until the line above expires
 */
export class SpeechBubble {
  #label
  #clock
  #text = ''
  #expiresAt = 0
  #priorityUntil = 0

  /**
   * @param {OverlayLabel} label
   * @param {Clock} clock
   */
  constructor(label, clock) {
    this.#label = label
    this.#clock = clock
    label.setVisible(false)
  }

  get text() {
    return this.#text
  }

  /**
   * @param {string} text
   * @param {BubbleOptions} [options] Without a duration the line stays until replaced.
   */
  show(text, { durationMs = 0, priority = false } = {}) {
    const now = this.#clock.now()
    if (!priority && now < this.#priorityUntil) return
    if (priority) this.#priorityUntil = now + durationMs
    this.#expiresAt = durationMs > 0 ? now + durationMs : 0
    this.#render(text)
  }

  /** Clears the bubble unless a priority line is still showing. */
  hide() {
    if (this.#clock.now() < this.#priorityUntil) return
    this.#render('')
  }

  /** Expires timed lines; call once per frame. */
  update() {
    if (this.#expiresAt === 0 || this.#clock.now() <= this.#expiresAt) return
    this.#expiresAt = 0
    this.#priorityUntil = 0
    this.#render('')
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} opacity
   */
  place(x, y, opacity) {
    this.#label.place(x, y, opacity)
  }

  dispose() {
    this.#label.remove()
  }

  /** @param {string} text */
  #render(text) {
    if (text === this.#text) return
    this.#text = text
    this.#label.setText(text)
    this.#label.setVisible(text !== '')
  }
}
