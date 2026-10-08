import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from '../lib/three.js'

/**
 * @typedef {import('./voxel-model.js').VoxelModel} VoxelModel
 * @typedef {readonly [number, number, number]} Vec3Tuple
 * @typedef {{ positions: number[], normals: number[], colors: number[], indices: number[] }} GeometryBuffers
 */

/** World size of one voxel: 16 voxels per floor tile. */
export const VOXEL_SIZE = 1 / 16

const FACES = /** @type {const} */ ([
  {
    normal: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    normal: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    normal: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
  {
    normal: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
])

// Baked per-face shading keeps the pixel-art look even where the lights barely reach.
const FACE_BRIGHTNESS = [0.88, 0.8, 1, 0.6, 0.94, 0.74]

const SHARED_LIT_MATERIAL = new MeshLambertMaterial({ vertexColors: true })

/**
 * A tiny per-voxel brightness variation imitates pixel-art palettes and avoids flat surfaces.
 * @param {number} x @param {number} y @param {number} z
 * @returns {number}
 * @example voxelNoise(0, 0, 0) // 0.965
 */
export function voxelNoise(x, y, z) {
  const noise = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 7
  return 0.965 + noise * 0.008
}

/**
 * Builds a geometry with only the faces that touch empty space, colored per vertex.
 * @param {VoxelModel} model
 * @param {Vec3Tuple} pivot In voxels; becomes the mesh origin.
 * @returns {BufferGeometry}
 * @example buildExposedFaceGeometry(new VoxelModel(1, 1, 1).paint(0, 0, 0, 0xff0000), [0, 0, 0])
 */
export function buildExposedFaceGeometry(model, pivot) {
  /** @type {GeometryBuffers} */
  const buffers = { positions: [], normals: [], colors: [], indices: [] }
  model.forEachCell((x, y, z) => {
    const color = model.colorAt(x, y, z)
    if (color < 0) return
    FACES.forEach((face, faceIndex) =>
      appendFaceIfExposed(buffers, model, [x, y, z], color, faceIndex, pivot),
    )
  })
  return toGeometry(buffers)
}

/**
 * @param {GeometryBuffers} buffers
 * @param {VoxelModel} model
 * @param {Vec3Tuple} cell
 * @param {number} hexColor
 * @param {number} faceIndex
 * @param {Vec3Tuple} pivot
 */
function appendFaceIfExposed(buffers, model, [x, y, z], hexColor, faceIndex, pivot) {
  const face = FACES[faceIndex]
  if (!face) return
  const [nx, ny, nz] = face.normal
  if (model.colorAt(x + nx, y + ny, z + nz) >= 0) return
  const color = new Color(hexColor).multiplyScalar((FACE_BRIGHTNESS[faceIndex] ?? 1) * voxelNoise(x, y, z))
  const base = buffers.positions.length / 3
  for (const [cx, cy, cz] of face.corners) {
    buffers.positions.push(
      ...[x + cx - pivot[0], y + cy - pivot[1], z + cz - pivot[2]].map(v => v * VOXEL_SIZE),
    )
    buffers.normals.push(nx, ny, nz)
    buffers.colors.push(color.r, color.g, color.b)
  }
  buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
}

/**
 * @param {GeometryBuffers} buffers
 * @returns {BufferGeometry}
 */
function toGeometry({ positions, normals, colors, indices }) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * The default pivot: centered on x and z, standing on y = 0.
 * @param {VoxelModel} model
 * @returns {Vec3Tuple}
 */
export function groundPivot(model) {
  return [model.width / 2, 0, model.depth / 2]
}

/**
 * Creates a lit, shadow-casting mesh from a voxel model.
 * @param {VoxelModel} model
 * @param {Vec3Tuple} [pivot]
 * @returns {Mesh}
 * @example scene.add(createVoxelMesh(deskModel()))
 */
export function createVoxelMesh(model, pivot = groundPivot(model)) {
  const mesh = new Mesh(buildExposedFaceGeometry(model, pivot), SHARED_LIT_MATERIAL)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Creates an unlit mesh for things that glow (LEDs, the coffee machine light); it casts no shadow.
 * @param {VoxelModel} model
 * @param {Vec3Tuple} [pivot]
 * @returns {Mesh}
 * @example createGlowingVoxelMesh(rackLedsModel(), [8, 0, 0])
 */
export function createGlowingVoxelMesh(model, pivot = groundPivot(model)) {
  const mesh = new Mesh(buildExposedFaceGeometry(model, pivot), new MeshBasicMaterial({ vertexColors: true }))
  mesh.castShadow = false
  return mesh
}
