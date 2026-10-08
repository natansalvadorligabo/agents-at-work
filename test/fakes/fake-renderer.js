/** A SceneRenderer that only counts frames. */
export class FakeRenderer {
  frames = 0
  /** @type {{ width: number, height: number } | null} */
  size = null

  render() {
    this.frames++
  }

  /** @param {number} width @param {number} height */
  setSize(width, height) {
    this.size = { width, height }
  }
}
