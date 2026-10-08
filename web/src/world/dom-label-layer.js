/**
 * @typedef {import('../agents/speech-bubble.js').LabelLayer} LabelLayer
 * @typedef {import('../agents/speech-bubble.js').OverlayLabel} OverlayLabel
 */

const CLASS_BY_KIND = { nameplate: 'nameplate', bubble: 'speech-bubble' }
const BUBBLE_LIFT_PX = 22

/**
 * HTML nameplates and speech bubbles positioned over the WebGL canvas.
 * @implements {LabelLayer}
 * @example
 * const labels = new DomLabelLayer(document.getElementById('labels'))
 * const plate = labels.createLabel('nameplate', true)
 */
export class DomLabelLayer {
  #container

  /** @param {HTMLElement} container */
  constructor(container) {
    this.#container = container
  }

  /**
   * @param {'nameplate' | 'bubble'} kind
   * @param {boolean} isMainAgent
   * @returns {OverlayLabel}
   */
  createLabel(kind, isMainAgent) {
    const element = this.#container.ownerDocument.createElement('div')
    element.className = CLASS_BY_KIND[kind]
    if (isMainAgent && kind === 'nameplate') element.classList.add('nameplate-main')
    this.#container.append(element)
    const lift = kind === 'bubble' ? BUBBLE_LIFT_PX : 0
    return {
      setText: text => void (element.textContent = text),
      setHtml: html => void (element.innerHTML = html),
      setVisible: visible => element.classList.toggle('hidden', !visible),
      place: (x, y, opacity) => {
        element.style.transform = `translate(-50%, -100%) translate(${x}px, ${y - lift}px)`
        element.style.opacity = String(opacity)
      },
      remove: () => element.remove(),
    }
  }
}
