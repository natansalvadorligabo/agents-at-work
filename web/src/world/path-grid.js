/** @typedef {readonly [number, number]} Cell */
/** @typedef {{ x: number, z: number, step: number }} Neighbor */
/** @typedef {{ key: number, priority: number }} OpenEntry */

const NEIGHBOR_OFFSETS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
]

/**
 * Walkability grid of the office floor with A* path finding.
 * @example
 * const grid = new PathGrid(14, 9)
 * grid.block(3, 3)
 * grid.findPath([0, 0], [5, 5]) // [[1, 1], [2, 2], …, [5, 5]]
 */
export class PathGrid {
  /**
   * @param {number} width
   * @param {number} depth
   */
  constructor(width, depth) {
    this.width = width
    this.depth = depth
    this.blocked = new Uint8Array(width * depth)
  }

  /**
   * Resizes the grid; all blocks are cleared.
   * @param {number} width
   * @param {number} depth
   */
  resize(width, depth) {
    this.width = width
    this.depth = depth
    this.blocked = new Uint8Array(width * depth)
  }

  clearBlocks() {
    this.blocked.fill(0)
  }

  /** @param {number} x @param {number} z */
  block(x, z) {
    if (this.isInside(x, z)) this.blocked[this.keyOf(x, z)] = 1
  }

  /** @param {number} x @param {number} z @returns {boolean} */
  isInside(x, z) {
    return x >= 0 && z >= 0 && x < this.width && z < this.depth
  }

  /** @param {number} x @param {number} z @returns {boolean} */
  isFree(x, z) {
    return this.isInside(x, z) && this.blocked[this.keyOf(x, z)] === 0
  }

  /** @param {number} x @param {number} z @returns {number} */
  keyOf(x, z) {
    return x + z * this.width
  }

  /** @param {number} key @returns {Cell} */
  cellOf(key) {
    return [key % this.width, Math.floor(key / this.width)]
  }

  /**
   * The closest free cell, searching outwards ring by ring; the cell itself when it is free.
   * @param {number} x
   * @param {number} z
   * @returns {Cell}
   */
  nearestFreeCell(x, z) {
    if (this.isFree(x, z)) return [x, z]
    for (let radius = 1; radius < Math.max(this.width, this.depth); radius++) {
      const found = ringCells(x, z, radius).find(([cx, cz]) => this.isFree(cx, cz))
      if (found) return found
    }
    return [x, z]
  }

  /**
   * Walkable neighbors. Diagonals need both orthogonal neighbors free, so characters do not cut furniture corners.
   * @param {number} x
   * @param {number} z
   * @returns {Neighbor[]}
   */
  walkableNeighbors(x, z) {
    return NEIGHBOR_OFFSETS.filter(([dx = 0, dz = 0]) => {
      if (!this.isFree(x + dx, z + dz)) return false
      return dx === 0 || dz === 0 || (this.isFree(x + dx, z) && this.isFree(x, z + dz))
    }).map(([dx = 0, dz = 0, step = 1]) => ({ x: x + dx, z: z + dz, step }))
  }

  /**
   * Shortest path between two cells, excluding the start and including the goal.
   * Blocked endpoints snap to the nearest free cell; with no path, the goal alone is returned.
   * @param {Cell} from
   * @param {Cell} to
   * @returns {Cell[]}
   */
  findPath(from, to) {
    const start = this.nearestFreeCell(from[0], from[1])
    const goal = this.nearestFreeCell(to[0], to[1])
    return new AStarSearch(this, start, goal).run() ?? [goal]
  }
}

/**
 * The cells on the square ring at the given Chebyshev distance.
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @returns {Cell[]}
 */
function ringCells(x, z, radius) {
  /** @type {Cell[]} */
  const cells = []
  const side = radius * 2 + 1
  for (let i = 0; i < side * side; i++) {
    const dx = (i % side) - radius
    const dz = Math.floor(i / side) - radius
    if (Math.max(Math.abs(dx), Math.abs(dz)) === radius) cells.push([x + dx, z + dz])
  }
  return cells
}

class AStarSearch {
  /** @type {Map<number, number>} */
  #cost = new Map()
  /** @type {Map<number, number>} */
  #previous = new Map()
  /** @type {OpenEntry[]} */
  #open = []
  /** @type {Set<number>} */
  #closed = new Set()
  #grid
  #startKey
  #goal

  /**
   * @param {PathGrid} grid
   * @param {Cell} start
   * @param {Cell} goal
   */
  constructor(grid, start, goal) {
    this.#grid = grid
    this.#goal = goal
    this.#startKey = grid.keyOf(start[0], start[1])
    this.#cost.set(this.#startKey, 0)
    this.#open.push({ key: this.#startKey, priority: this.#heuristic(start[0], start[1]) })
  }

  /** @returns {Cell[] | null} */
  run() {
    const goalKey = this.#grid.keyOf(this.#goal[0], this.#goal[1])
    while (this.#open.length > 0) {
      const key = this.#popBest()
      if (this.#closed.has(key)) continue
      this.#closed.add(key)
      if (key === goalKey) return this.#reconstruct(key)
      this.#expand(key)
    }
    return null
  }

  /** @returns {number} */
  #popBest() {
    let best = 0
    for (let i = 1; i < this.#open.length; i++) {
      if ((this.#open[i]?.priority ?? Infinity) < (this.#open[best]?.priority ?? Infinity)) best = i
    }
    return /** @type {OpenEntry} */ (this.#open.splice(best, 1)[0]).key
  }

  /** @param {number} key */
  #expand(key) {
    const [x, z] = this.#grid.cellOf(key)
    const baseCost = this.#cost.get(key) ?? 0
    for (const neighbor of this.#grid.walkableNeighbors(x, z)) {
      const neighborKey = this.#grid.keyOf(neighbor.x, neighbor.z)
      const cost = baseCost + neighbor.step
      if (cost >= (this.#cost.get(neighborKey) ?? Infinity)) continue
      this.#cost.set(neighborKey, cost)
      this.#previous.set(neighborKey, key)
      this.#open.push({ key: neighborKey, priority: cost + this.#heuristic(neighbor.x, neighbor.z) })
    }
  }

  /** @param {number} x @param {number} z @returns {number} */
  #heuristic(x, z) {
    return Math.hypot(x - this.#goal[0], z - this.#goal[1])
  }

  /** @param {number} goalKey @returns {Cell[]} */
  #reconstruct(goalKey) {
    /** @type {Cell[]} */
    const path = []
    for (let key = goalKey; key !== this.#startKey; key = this.#previous.get(key) ?? this.#startKey) {
      path.push(this.#grid.cellOf(key))
    }
    return path.reverse()
  }
}
