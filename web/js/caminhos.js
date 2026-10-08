const VIZINHOS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
]

export class GradeDeCaminhos {
  constructor(largura, profundidade) {
    this.redimensionar(largura, profundidade)
  }

  redimensionar(largura, profundidade) {
    this.largura = largura
    this.profundidade = profundidade
    this.bloqueios = new Uint8Array(largura * profundidade)
  }

  limparBloqueios() {
    this.bloqueios.fill(0)
  }

  dentro(x, z) {
    return x >= 0 && z >= 0 && x < this.largura && z < this.profundidade
  }

  bloquear(x, z) {
    if (this.dentro(x, z)) this.bloqueios[x + z * this.largura] = 1
  }

  livre(x, z) {
    return this.dentro(x, z) && this.bloqueios[x + z * this.largura] === 0
  }

  celulaLivreMaisProxima(x, z) {
    if (this.livre(x, z)) return [x, z]
    for (let raio = 1; raio < Math.max(this.largura, this.profundidade); raio++) {
      for (let dz = -raio; dz <= raio; dz++)
        for (let dx = -raio; dx <= raio; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== raio) continue
          if (this.livre(x + dx, z + dz)) return [x + dx, z + dz]
        }
    }
    return [x, z]
  }

  // Diagonal só com os dois vizinhos ortogonais livres, para o personagem não cortar quina de móvel.
  encontrarCaminho(origem, destino) {
    const [origemX, origemZ] = this.celulaLivreMaisProxima(...origem)
    const [destinoX, destinoZ] = this.celulaLivreMaisProxima(...destino)
    const chave = (x, z) => x + z * this.largura
    const heuristica = (x, z) => Math.hypot(x - destinoX, z - destinoZ)
    const custo = new Map([[chave(origemX, origemZ), 0]])
    const anterior = new Map()
    const abertos = [{ x: origemX, z: origemZ, prioridade: heuristica(origemX, origemZ) }]
    const fechados = new Set()

    while (abertos.length > 0) {
      let melhor = 0
      for (let i = 1; i < abertos.length; i++) if (abertos[i].prioridade < abertos[melhor].prioridade) melhor = i
      const atual = abertos.splice(melhor, 1)[0]
      const chaveAtual = chave(atual.x, atual.z)
      if (fechados.has(chaveAtual)) continue
      fechados.add(chaveAtual)
      if (atual.x === destinoX && atual.z === destinoZ) return this.reconstruir(anterior, chaveAtual, chave(origemX, origemZ))

      for (const [dx, dz, passo] of VIZINHOS) {
        const x = atual.x + dx
        const z = atual.z + dz
        if (!this.livre(x, z)) continue
        if (dx !== 0 && dz !== 0 && (!this.livre(atual.x + dx, atual.z) || !this.livre(atual.x, atual.z + dz))) continue
        const chaveVizinho = chave(x, z)
        const novoCusto = custo.get(chaveAtual) + passo
        if (novoCusto >= (custo.get(chaveVizinho) ?? Infinity)) continue
        custo.set(chaveVizinho, novoCusto)
        anterior.set(chaveVizinho, chaveAtual)
        abertos.push({ x, z, prioridade: novoCusto + heuristica(x, z) })
      }
    }
    return [[destinoX, destinoZ]]
  }

  reconstruir(anterior, chaveFinal, chaveOrigem) {
    const caminho = []
    let chaveAtual = chaveFinal
    while (chaveAtual !== undefined && chaveAtual !== chaveOrigem) {
      caminho.push([chaveAtual % this.largura, Math.floor(chaveAtual / this.largura)])
      chaveAtual = anterior.get(chaveAtual)
    }
    return caminho.reverse()
  }
}
