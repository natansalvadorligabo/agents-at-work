/** @typedef {import('../i18n/translator.js').Translator} Translator */

/**
 * @typedef {object} HeaderElements
 * @property {HTMLElement} project The door plate with the project name.
 * @property {HTMLElement} connection The connection indicator dot.
 * @property {HTMLElement} endedNotice
 * @property {HTMLElement} recenter
 */

/**
 * The top bar and session notices: project name, connection dot, "session ended" and the recenter button.
 * @example
 * const header = new HeaderView(elements, translator)
 * header.showSession({ project: 'shop', ended: false })
 */
export class HeaderView {
  /** @type {string | null} */
  #project = null
  #elements
  #translator

  /**
   * @param {HeaderElements} elements
   * @param {Translator} translator
   */
  constructor(elements, translator) {
    this.#elements = elements
    this.#translator = translator
    translator.onChange(() => this.#renderProject())
    this.#renderProject()
  }

  /** @param {{ project: string, ended: boolean }} session */
  showSession({ project, ended }) {
    this.#project = project
    this.#renderProject()
    this.#elements.endedNotice.classList.toggle('hidden', !ended)
  }

  /** @param {boolean} connected */
  setConnected(connected) {
    this.#elements.connection.classList.toggle('connected', connected)
  }

  /** @param {boolean} visible */
  setRecenterVisible(visible) {
    this.#elements.recenter.classList.toggle('hidden', !visible)
  }

  #renderProject() {
    const t = this.#translator.t.bind(this.#translator)
    const fallback = this.#project === null ? t('header.waitingForSession') : t('header.sessionFallback')
    this.#elements.project.textContent = this.#project || fallback
  }
}
