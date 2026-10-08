import * as THREE from 'three'

export const TAMANHO_VOXEL = 1 / 16

const DIRECOES_FACES = [
  { normal: [1, 0, 0], cantos: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], cantos: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [0, 1, 0], cantos: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], cantos: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], cantos: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { normal: [0, 0, -1], cantos: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
]

const INTENSIDADE_POR_FACE = [0.88, 0.8, 1, 0.6, 0.94, 0.74]

// Convenção dos modelos: x para a direita, y para cima, z para a frente (onde ficam os olhos).
export class ModeloVoxel {
  constructor(largura, altura, profundidade) {
    this.largura = largura
    this.altura = altura
    this.profundidade = profundidade
    this.celulas = new Int32Array(largura * altura * profundidade).fill(-1)
  }

  indice(x, y, z) {
    return x + this.largura * (y + this.altura * z)
  }

  contem(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.largura && y < this.altura && z < this.profundidade
  }

  cor(x, y, z) {
    return this.contem(x, y, z) ? this.celulas[this.indice(x, y, z)] : -1
  }

  pintar(x, y, z, cor) {
    if (this.contem(x, y, z)) this.celulas[this.indice(x, y, z)] = cor
    return this
  }

  preencher(x0, y0, z0, x1, y1, z1, cor) {
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) this.pintar(x, y, z, cor)
    return this
  }

  remover(x0, y0, z0, x1, y1, z1) {
    return this.preencher(x0, y0, z0, x1, y1, z1, -1)
  }
}

function fatorRuidoVoxel(x, y, z) {
  // Uma variação mínima por voxel imita o ruído das paletas de pixel art e evita superfícies chapadas.
  const ruido = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 7
  return 0.965 + ruido * 0.008
}

export function construirGeometriaFacesExpostas(modelo, pivoEmVoxels = [modelo.largura / 2, 0, modelo.profundidade / 2]) {
  const posicoes = []
  const normais = []
  const cores = []
  const indices = []
  const cor = new THREE.Color()
  const [pivoX, pivoY, pivoZ] = pivoEmVoxels

  for (let z = 0; z < modelo.profundidade; z++) {
    for (let y = 0; y < modelo.altura; y++) {
      for (let x = 0; x < modelo.largura; x++) {
        const valor = modelo.cor(x, y, z)
        if (valor < 0) continue
        DIRECOES_FACES.forEach((face, numeroFace) => {
          const [nx, ny, nz] = face.normal
          if (modelo.cor(x + nx, y + ny, z + nz) >= 0) return
          const base = posicoes.length / 3
          cor.setHex(valor).multiplyScalar(INTENSIDADE_POR_FACE[numeroFace] * fatorRuidoVoxel(x, y, z))
          for (const [cx, cy, cz] of face.cantos) {
            posicoes.push((x + cx - pivoX) * TAMANHO_VOXEL, (y + cy - pivoY) * TAMANHO_VOXEL, (z + cz - pivoZ) * TAMANHO_VOXEL)
            normais.push(nx, ny, nz)
            cores.push(cor.r, cor.g, cor.b)
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
        })
      }
    }
  }

  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3))
  geometria.setAttribute('normal', new THREE.Float32BufferAttribute(normais, 3))
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
  geometria.setIndex(indices)
  geometria.computeBoundingSphere()
  return geometria
}

const MATERIAL_VOXEL = new THREE.MeshLambertMaterial({ vertexColors: true })

export function criarMalha(modelo, pivoEmVoxels) {
  const malha = new THREE.Mesh(construirGeometriaFacesExpostas(modelo, pivoEmVoxels), MATERIAL_VOXEL)
  malha.castShadow = true
  malha.receiveShadow = true
  return malha
}
