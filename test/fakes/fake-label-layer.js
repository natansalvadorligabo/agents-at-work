/** An OverlayLabel that records what it was told. */
export class FakeLabel {
  text = ''
  html = ''
  visible = true
  removed = false
  /** @type {{ x: number, y: number, opacity: number } | null} */
  placement = null

  /** @param {'nameplate' | 'bubble'} kind @param {boolean} isMainAgent */
  constructor(kind, isMainAgent) {
    this.kind = kind
    this.isMainAgent = isMainAgent
  }

  /** @param {string} text */
  setText(text) {
    this.text = text
  }

  /** @param {string} html */
  setHtml(html) {
    this.html = html
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.visible = visible
  }

  /** @param {number} x @param {number} y @param {number} opacity */
  place(x, y, opacity) {
    this.placement = { x, y, opacity }
  }

  remove() {
    this.removed = true
  }
}

/** A LabelLayer keeping every label it created. */
export class FakeLabelLayer {
  /** @type {FakeLabel[]} */
  labels = []

  /** @param {'nameplate' | 'bubble'} kind @param {boolean} isMainAgent */
  createLabel(kind, isMainAgent) {
    const label = new FakeLabel(kind, isMainAgent)
    this.labels.push(label)
    return label
  }

  /** @returns {string[]} Texts of the speech bubbles currently showing. */
  visibleBubbleTexts() {
    return this.labels
      .filter(label => label.kind === 'bubble' && label.visible && !label.removed)
      .map(label => label.text)
  }
}
