/** Value of an empty cell. */
export const EMPTY = -1

/**
 * @typedef {(x: number, y: number, z: number) => number | null} VoxelPainter
 *   Returns the cell's new color (EMPTY clears it), or null to leave the cell as it is.
 */

/**
 * A dense box of colored voxels. Model convention: x to the right, y up, z to the front (where the eyes are).
 * Methods return `this` so models read as a chain of fills.
 * @example new VoxelModel(3, 6, 4).fill(0, 0, 0, 2, 1, 3, 0x3a2618)
 */
export class VoxelModel {
  /**
   * @param {number} width
   * @param {number} height
   * @param {number} depth
   */
  constructor(width, height, depth) {
    if (![width, height, depth].every(size => Number.isInteger(size) && size > 0)) {
      throw new RangeError(`Invalid voxel model size ${width}×${height}×${depth}; expected positive integers`)
    }
    this.width = width
    this.height = height
    this.depth = depth
    this.cells = new Int32Array(width * height * depth).fill(EMPTY)
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  contains(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.width && y < this.height && z < this.depth
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number} The color, or EMPTY outside the model.
   */
  colorAt(x, y, z) {
    return this.contains(x, y, z) ? (this.cells[this.#index(x, y, z)] ?? EMPTY) : EMPTY
  }

  /**
   * Paints one voxel; coordinates outside the model are ignored so shapes can be clipped freely.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} color
   * @returns {this}
   */
  paint(x, y, z, color) {
    if (this.contains(x, y, z)) this.cells[this.#index(x, y, z)] = color
    return this
  }

  /**
   * Fills the inclusive box from (x0, y0, z0) to (x1, y1, z1).
   * @param {number} x0 @param {number} y0 @param {number} z0
   * @param {number} x1 @param {number} y1 @param {number} z1
   * @param {number} color
   * @returns {this}
   */
  fill(x0, y0, z0, x1, y1, z1, color) {
    const [width, height, depth] = [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1]
    if (width <= 0 || height <= 0 || depth <= 0) return this
    for (let i = 0; i < width * height * depth; i++) {
      this.paint(
        x0 + (i % width),
        y0 + (Math.floor(i / width) % height),
        z0 + Math.floor(i / (width * height)),
        color,
      )
    }
    return this
  }

  /**
   * Empties the inclusive box.
   * @param {number} x0 @param {number} y0 @param {number} z0
   * @param {number} x1 @param {number} y1 @param {number} z1
   * @returns {this}
   */
  clear(x0, y0, z0, x1, y1, z1) {
    return this.fill(x0, y0, z0, x1, y1, z1, EMPTY)
  }

  /**
   * Offers every cell to the painter; procedural shapes (spheres, foliage, puddles) are written this way.
   * @param {VoxelPainter} painter
   * @returns {this}
   */
  paintEach(painter) {
    this.forEachCell((x, y, z) => {
      const color = painter(x, y, z)
      if (color !== null) this.cells[this.#index(x, y, z)] = color
    })
    return this
  }

  /**
   * Visits every cell in z, y, x order.
   * @param {(x: number, y: number, z: number) => void} visit
   */
  forEachCell(visit) {
    for (let index = 0; index < this.cells.length; index++) {
      const x = index % this.width
      const y = Math.floor(index / this.width) % this.height
      visit(x, y, Math.floor(index / (this.width * this.height)))
    }
  }

  /** @returns {number} How many cells hold a color. */
  get filledCount() {
    return this.cells.reduce((count, cell) => count + (cell === EMPTY ? 0 : 1), 0)
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   */
  #index(x, y, z) {
    return x + this.width * (y + this.height * z)
  }
}
