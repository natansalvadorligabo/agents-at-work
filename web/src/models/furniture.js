import { VoxelModel } from '../voxel/voxel-model.js'
import { PALETTE, blend } from './palette.js'

const BOOK_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085, 0xd35400, 0x34495e, 0xe8e2d0]
const SHELF_LEVELS = [2, 10, 18, 26]
const DESK_LEG_CORNERS = /** @type {const} */ ([
  [0, 0],
  [26, 0],
  [0, 12],
  [26, 12],
])
const GLOBE_TABLE_LEG_CORNERS = /** @type {const} */ ([
  [1, 1],
  [11, 1],
  [1, 11],
  [11, 11],
])
const RACK_DRAWER_ROWS = [3, 8, 13, 18, 23, 28]

/**
 * A desk with monitor, keyboard, mouse and a coffee cup, 28×20×14 voxels.
 * @returns {VoxelModel}
 * @example createVoxelMesh(deskModel(), [14, 0, 7])
 */
export function deskModel() {
  const desk = new VoxelModel(28, 20, 14)
    .fill(0, 10, 0, 27, 11, 13, PALETTE.woodTop)
    .fill(0, 10, 13, 27, 10, 13, PALETTE.lightWood)
    .fill(2, 3, 0, 25, 9, 0, PALETTE.lightWood)
  for (const [x, z] of DESK_LEG_CORNERS) desk.fill(x, 0, z, x + 1, 9, z + 1, PALETTE.darkWood)
  return desk
    .fill(9, 12, 2, 18, 12, 4, PALETTE.darkMetal)
    .fill(13, 13, 3, 14, 14, 3, PALETTE.darkMetal)
    .fill(7, 14, 2, 20, 19, 3, PALETTE.monitorFrame)
    .fill(8, 15, 3, 19, 18, 3, PALETTE.monitorScreen)
    .fill(9, 17, 3, 14, 17, 3, 0xbff6ff)
    .fill(9, 16, 3, 16, 16, 3, 0x8fe6f5)
    .fill(9, 12, 8, 18, 12, 10, PALETTE.keyboard)
    .fill(21, 12, 8, 22, 12, 10, PALETTE.greyMetal)
    .fill(2, 12, 3, 4, 14, 5, 0xe9e2d0)
    .fill(3, 14, 4, 3, 15, 4, 0x6e4a2c)
}

/**
 * @returns {VoxelModel}
 * @example createVoxelMesh(chairModel(), [5, 0, 5])
 */
export function chairModel() {
  return new VoxelModel(10, 15, 10)
    .fill(4, 0, 4, 5, 6, 5, PALETTE.darkMetal)
    .fill(1, 0, 4, 8, 0, 5, PALETTE.darkMetal)
    .fill(4, 0, 1, 5, 0, 8, PALETTE.darkMetal)
    .fill(0, 7, 0, 9, 8, 9, PALETTE.chairFabric)
    .fill(0, 9, 8, 9, 14, 9, PALETTE.chairFabric)
    .fill(1, 10, 9, 8, 13, 9, blend(PALETTE.chairFabric, 0xffffff, 0.15))
}

/**
 * Places one book and returns the x where the next one starts. The arithmetic only scatters widths,
 * heights, gaps and colors so the shelves look hand-filled while staying deterministic.
 * @param {VoxelModel} shelf
 * @param {number} x
 * @param {number} base
 * @param {number} book
 * @returns {number}
 */
function addBook(shelf, x, base, book) {
  const width = 1 + (book % 2)
  const height = 4 + ((book * 7) % 3)
  const color = BOOK_COLORS[(book * 3) % BOOK_COLORS.length] ?? PALETTE.redSeal
  if ((book * 5) % 11 !== 0) shelf.fill(x, base, 3, Math.min(26, x + width - 1), base + height, 7, color)
  return x + width + ((book * 13) % 5 === 0 ? 1 : 0)
}

/**
 * @param {VoxelModel} shelf
 * @param {number} base
 */
function addShelfWithBooks(shelf, base) {
  shelf.fill(2, base - 1, 1, 27, base - 1, 8, PALETTE.lightWood)
  for (let x = 3, book = base; x < 26; book++) x = addBook(shelf, x, base, book)
}

/**
 * The reading station (Read, Grep, Glob…).
 * @returns {VoxelModel}
 * @example bookshelfModel().width // 30
 */
export function bookshelfModel() {
  const shelf = new VoxelModel(30, 36, 9).fill(0, 0, 0, 29, 35, 8, PALETTE.darkWood).clear(2, 2, 2, 27, 33, 8)
  for (const base of SHELF_LEVELS) addShelfWithBooks(shelf, base)
  return shelf.fill(2, 33, 1, 27, 33, 8, PALETTE.lightWood)
}

/**
 * The planning station (TodoWrite, plan mode, long thinking), with scribbles on it.
 * @returns {VoxelModel}
 * @example whiteboardModel().height // 34
 */
export function whiteboardModel() {
  const board = new VoxelModel(32, 34, 6)
    .fill(1, 0, 1, 2, 12, 4, PALETTE.greyMetal)
    .fill(29, 0, 1, 30, 12, 4, PALETTE.greyMetal)
    .fill(0, 12, 2, 31, 33, 3, PALETTE.greyMetal)
    .fill(1, 13, 3, 30, 32, 3, PALETTE.whiteboard)
    .fill(0, 12, 4, 31, 12, 5, PALETTE.greyMetal)
    .fill(4, 29, 3, 18, 29, 3, PALETTE.blueMarker)
    .fill(4, 26, 3, 13, 26, 3, PALETTE.blueMarker)
    .fill(15, 26, 3, 22, 26, 3, PALETTE.blueMarker)
    .fill(4, 23, 3, 10, 23, 3, PALETTE.greenMarker)
  for (let i = 0; i < 7; i++)
    board.paint(20 + i, 17 + Math.round(Math.abs(3 - i) * 0.8), 3, PALETTE.redMarker)
  return board
    .clear(5, 16, 3, 9, 20, 3)
    .fill(5, 16, 3, 5, 20, 3, PALETTE.blueMarker)
    .fill(5, 16, 3, 9, 16, 3, PALETTE.blueMarker)
    .fill(9, 13, 4, 11, 13, 5, PALETTE.redMarker)
    .fill(14, 13, 4, 16, 13, 5, PALETTE.blueMarker)
}

/**
 * The terminal station (Bash, PowerShell…).
 * @returns {VoxelModel}
 * @example serverRackModel().depth // 12
 */
export function serverRackModel() {
  const rack = new VoxelModel(16, 36, 12).fill(0, 0, 0, 15, 35, 11, PALETTE.rackDark)
  for (const y of RACK_DRAWER_ROWS)
    rack.fill(2, y, 11, 13, y + 3, 11, PALETTE.rackDrawer).fill(3, y + 1, 11, 8, y + 1, 11, 0x3d4558)
  return rack
}

/**
 * The rack's LEDs, a separate unlit mesh so they can blink.
 * @returns {VoxelModel}
 * @example createGlowingVoxelMesh(rackLedsModel(), [8, 0, 0])
 */
export function rackLedsModel() {
  const leds = new VoxelModel(16, 36, 1)
  for (const y of RACK_DRAWER_ROWS) {
    leds
      .paint(11, y + 2, 0, PALETTE.greenLed)
      .paint(12, y + 2, 0, y % 10 === 3 ? PALETTE.amberLed : PALETTE.greenLed)
  }
  return leds
}

/**
 * The web station (WebSearch, WebFetch): a small table with a globe.
 * @returns {VoxelModel}
 * @example globeTableModel().height // 26
 */
export function globeTableModel() {
  const table = new VoxelModel(14, 26, 14).fill(0, 9, 0, 13, 10, 13, PALETTE.woodTop)
  for (const [x, z] of GLOBE_TABLE_LEG_CORNERS) table.fill(x, 0, z, x + 1, 8, z + 1, PALETTE.darkWood)
  table.fill(5, 11, 5, 8, 11, 8, PALETTE.brassRim).fill(6, 12, 6, 7, 13, 7, PALETTE.brassRim)
  return table.paintEach((x, y, z) => {
    if (Math.hypot(x - 6.5, y - 19, z - 6.5) > 5.6) return null
    const isLand = Math.sin(x * 0.9 + y * 0.4) + Math.cos(z * 0.8 - y * 0.5) > 0.6
    return isLand ? PALETTE.land : PALETTE.ocean
  })
}

/**
 * @returns {VoxelModel}
 * @example windowModel().depth // 2
 */
export function windowModel() {
  const window = new VoxelModel(28, 22, 2)
    .fill(0, 0, 0, 27, 21, 1, PALETTE.lightWood)
    .fill(2, 2, 1, 12, 19, 1, PALETTE.skyGlass)
    .fill(15, 2, 1, 25, 19, 1, PALETTE.skyGlass)
  for (let i = 0; i < 5; i++)
    window.paint(4 + i, 15 - i, 1, PALETTE.skyGlassLight).paint(17 + i, 15 - i, 1, PALETTE.skyGlassLight)
  return window.fill(4, 5, 1, 8, 6, 1, 0xffffff).fill(18, 9, 1, 23, 10, 1, 0xffffff)
}

/**
 * The MCP station: a table with an old red phone.
 * @returns {VoxelModel}
 * @example phoneTableModel().width // 14
 */
export function phoneTableModel() {
  return new VoxelModel(14, 15, 12)
    .fill(0, 9, 0, 13, 10, 11, PALETTE.woodTop)
    .fill(1, 0, 1, 12, 8, 10, PALETTE.lightWood)
    .fill(2, 4, 10, 11, 4, 10, PALETTE.darkWood)
    .fill(3, 11, 3, 10, 12, 8, PALETTE.redPhone)
    .fill(3, 13, 3, 10, 13, 4, PALETTE.redPhone)
    .fill(3, 13, 7, 10, 13, 8, PALETTE.redPhone)
    .fill(5, 13, 5, 8, 14, 6, 0x5e1b20)
    .fill(5, 12, 9, 8, 12, 9, 0xe8e2d0)
}

/**
 * @returns {VoxelModel}
 * @example pottedPlantModel().height // 20
 */
export function pottedPlantModel() {
  return new VoxelModel(10, 20, 10)
    .fill(2, 0, 2, 7, 6, 7, PALETTE.terracotta)
    .fill(1, 6, 1, 8, 7, 8, blend(PALETTE.terracotta, 0xffffff, 0.15))
    .paintEach((x, y, z) => {
      const insideBush = y >= 8 && Math.hypot(x - 4.5, (y - 13) * 0.8, z - 4.5) < 4.6
      if (!insideBush || (x * 7 + y * 3 + z * 5) % 4 === 0) return null
      return (x + y + z) % 3 === 0 ? PALETTE.leafLight : PALETTE.leafGreen
    })
}

/**
 * @returns {VoxelModel}
 * @example doorFrameModel().depth // 20
 */
export function doorFrameModel() {
  return new VoxelModel(4, 36, 20)
    .fill(0, 0, 0, 3, 35, 1, PALETTE.darkWood)
    .fill(0, 0, 18, 3, 35, 19, PALETTE.darkWood)
    .fill(0, 33, 0, 3, 35, 19, PALETTE.darkWood)
}

/**
 * @returns {VoxelModel}
 * @example createVoxelMesh(doorLeafModel(), [1, 0, 0])
 */
export function doorLeafModel() {
  const panel = blend(PALETTE.lightWood, 0x000000, 0.12)
  return new VoxelModel(2, 32, 16)
    .fill(0, 0, 0, 1, 31, 15, PALETTE.lightWood)
    .fill(0, 4, 2, 1, 13, 13, panel)
    .fill(0, 18, 2, 1, 28, 13, panel)
    .fill(0, 15, 12, 1, 16, 13, PALETTE.brassRim)
}
