// Floor plan of the office, in tiles (1 tile = 1 world unit). x grows to the right, z towards the viewer.

/** @typedef {readonly [number, number]} Point2 An [x, z] position on the floor. */
/** @typedef {{ x: number, z: number }} Tile */
/** @typedef {'bookshelf' | 'whiteboard' | 'rack' | 'globe' | 'phone'} StationName */
/** @typedef {{ point: Point2, facing: number }} Station */

export const ROOM_DEPTH = 9
export const MIN_ROOM_WIDTH = 14
export const WALL_HEIGHT = 2.6
export const WALL_THICKNESS = 0.2
export const DOOR_ROW = 6

const FIRST_DESK_COLUMN = 5
const DESK_COLUMN_SPACING = 3
const DESK_ROWS = [3, 6]

/** The main agent's desk occupies this tile and the one to its right. */
export const MAIN_DESK = Object.freeze({ x: 1, z: 3 })

/** Seated agents face the back wall (their monitor). */
export const SEATED_FACING = Math.PI

/** Where the coffee counter stands, against the left wall. */
export const COFFEE_BAR_POSITION = Object.freeze({ x: 0.38, z: 5.0 })

/** Standing agents at the counter face the left wall. */
export const COFFEE_FACING = -Math.PI / 2

/** Standing spots in front of the counter; latecomers form a second ring next to them. */
export const COFFEE_SPOTS = /** @type {readonly Point2[]} */ ([
  [1.0, 4.45],
  [1.0, 5.35],
  [1.65, 4.9],
  [1.65, 5.8],
  [2.2, 5.35],
  [2.2, 6.2],
])

/** @type {Readonly<Record<StationName, Station>>} */
export const STATIONS = Object.freeze({
  bookshelf: { point: [1.0, 1.35], facing: Math.PI },
  whiteboard: { point: [4.0, 1.3], facing: Math.PI },
  rack: { point: [6.5, 1.45], facing: Math.PI },
  globe: { point: [8.5, 1.5], facing: Math.PI },
  phone: { point: [10.5, 1.4], facing: Math.PI },
})

// Tiles under furniture along the back wall, the plant by the door and the coffee counter.
const FIXED_BLOCKED_TILES = /** @type {readonly Point2[]} */ ([
  [0, 0],
  [1, 0],
  [3, 0],
  [4, 0],
  [6, 0],
  [8, 0],
  [10, 0],
  [12, 0],
  [0, 8],
  [0, 4],
  [0, 5],
])

export const DOOR_INSIDE = /** @type {Point2} */ ([0.5, DOOR_ROW + 0.5])
export const DOOR_OUTSIDE = /** @type {Point2} */ ([-1.1, DOOR_ROW + 0.5])

/**
 * Tile of a subagent desk slot. Slots fill columns top to bottom, then grow the room to the right.
 * @param {number} slot
 * @returns {Tile}
 * @example deskSlotTile(1) // { x: 5, z: 6 }
 */
export function deskSlotTile(slot) {
  const column = Math.floor(slot / DESK_ROWS.length)
  const row = DESK_ROWS[slot % DESK_ROWS.length] ?? 0
  return { x: FIRST_DESK_COLUMN + column * DESK_COLUMN_SPACING, z: row }
}

/**
 * Where an agent sits at a desk on the given tile.
 * @param {Tile} desk
 * @returns {Point2}
 * @example seatAt(MAIN_DESK) // [2, 4.3]
 */
export function seatAt(desk) {
  return [desk.x + 1, desk.z + 1.3]
}

/**
 * Room width needed so every occupied desk slot fits, never narrower than the starting room.
 * @param {Iterable<number>} occupiedSlots
 * @returns {number}
 * @example requiredRoomWidth([0, 1, 2]) // 14
 */
export function requiredRoomWidth(occupiedSlots) {
  let lastColumn = -1
  for (const slot of occupiedSlots) lastColumn = Math.max(lastColumn, Math.floor(slot / DESK_ROWS.length))
  return Math.max(MIN_ROOM_WIDTH, FIRST_DESK_COLUMN + (lastColumn + 1) * DESK_COLUMN_SPACING + 1)
}

/**
 * Every tile agents cannot walk on, given the occupied desk slots.
 * @param {Iterable<number>} occupiedSlots
 * @returns {Point2[]}
 * @example blockedTiles([]).length // 13
 */
export function blockedTiles(occupiedSlots) {
  const desks = [MAIN_DESK, ...[...occupiedSlots].map(deskSlotTile)]
  /** @type {Point2[]} */
  const deskTiles = desks.flatMap(({ x, z }) => [
    [x, z],
    [x + 1, z],
  ])
  return [...FIXED_BLOCKED_TILES, ...deskTiles]
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} roomWidth
 * @returns {boolean}
 */
export function isInsideRoom(x, z, roomWidth) {
  return x >= 0 && z >= 0 && x < roomWidth && z < ROOM_DEPTH
}
