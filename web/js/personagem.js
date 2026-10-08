import * as THREE from 'three'
import { TAMANHO_VOXEL as V, criarMalha } from './voxel.js'
import {
  aparenciaDoAgente,
  modeloBraco,
  modeloCabeca,
  modeloCaneca,
  modeloChapeu,
  modeloEnvelope,
  modeloObjetoNaMao,
  modeloPerna,
  modeloTronco,
} from './modelos.js'

const VELOCIDADE_CAMINHADA = 2.4
const MULTIPLICADOR_CORRIDA = 2.2
const AMPLITUDE_TREMEDEIRA = 0.6 * (1 / 16)
const VELOCIDADE_GIRO = 10
const ALTURA_CABECA = 22 * V
const ALTURA_ASSENTO = 3 * V

const ALTURA_CHAPEU_POR_TIPO = { Explore: 18.5, Plan: 19 }

function interpolarAngulo(atual, alvo, fator) {
  let diferenca = alvo - atual
  while (diferenca > Math.PI) diferenca -= Math.PI * 2
  while (diferenca < -Math.PI) diferenca += Math.PI * 2
  return atual + diferenca * fator
}

function aproximar(atual, alvo, fator) {
  return atual + (alvo - atual) * fator
}

export class FiguraAgente {
  constructor(dados, camadaHtml) {
    this.id = dados.id
    this.dados = dados
    this.aparencia = aparenciaDoAgente(dados.id, dados.tipoAgente)
    this.grupo = new THREE.Group()
    this.grupo.userData.figura = this
    this.corpo = new THREE.Group()
    this.grupo.add(this.corpo)
    this.montarCorpo()

    this.caminho = []
    this.direcao = 0
    this.direcaoAlvo = 0
    this.pose = 'emPe'
    this.escalaAlvo = 1
    this.corpo.scale.setScalar(0.001)
    this.tempoAnimacao = Math.random() * 10
    this.travadoAte = 0
    this.correndoAte = 0
    this.tremendoAte = 0
    this.objetoCarregado = null

    this.elementoPlaca = document.createElement('div')
    this.elementoPlaca.className = `placa-agente ${dados.tipoAgente === 'principal' ? 'placa-principal' : ''}`
    this.elementoBalao = document.createElement('div')
    this.elementoBalao.className = 'balao-agente oculto'
    camadaHtml.append(this.elementoPlaca, this.elementoBalao)
    this.atualizarPlaca()
    this.textoBalao = ''
    this.balaoExpiraEm = 0
    this.balaoPrioritarioAte = 0
  }

  montarCorpo() {
    const aparencia = this.aparencia
    const articulacao = (malha, x, y, z) => {
      const grupo = new THREE.Group()
      grupo.position.set(x * V, y * V, z * V)
      grupo.add(malha)
      this.corpo.add(grupo)
      return grupo
    }

    this.pernaEsquerda = articulacao(criarMalha(modeloPerna(aparencia), [1.5, 6, 2]), -2, 6, 0)
    this.pernaDireita = articulacao(criarMalha(modeloPerna(aparencia), [1.5, 6, 2]), 2, 6, 0)
    this.tronco = articulacao(criarMalha(modeloTronco(aparencia), [4, 0, 2.5]), 0, 6, 0)
    this.bracoEsquerdo = articulacao(criarMalha(modeloBraco(aparencia), [1, 6, 1.5]), -5, 13, 0)
    this.bracoDireito = articulacao(criarMalha(modeloBraco(aparencia), [1, 6, 1.5]), 5, 13, 0)
    this.cabeca = articulacao(criarMalha(modeloCabeca(aparencia), [4, 0, 3.5]), 0, 13, 0)

    const chapeu = modeloChapeu(aparencia)
    if (chapeu) {
      const malhaChapeu = criarMalha(chapeu, [chapeu.largura / 2, 0, chapeu.profundidade / 2])
      malhaChapeu.position.y = ((ALTURA_CHAPEU_POR_TIPO[aparencia.tipoAgente] ?? 19.5) - 13) * V
      this.cabeca.add(malhaChapeu)
    }

    this.maoDireita = new THREE.Group()
    this.maoDireita.position.set(0, -5.5 * V, 1 * V)
    this.bracoDireito.add(this.maoDireita)
    const objetoNaMao = modeloObjetoNaMao(aparencia)
    if (objetoNaMao) {
      this.objetoDoTipo = criarMalha(objetoNaMao, [objetoNaMao.largura / 2, 1, objetoNaMao.profundidade / 2])
      this.maoDireita.add(this.objetoDoTipo)
    }
    const caneca = modeloCaneca()
    this.caneca = criarMalha(caneca, [1.5, 0, 1.5])
    this.caneca.rotation.x = Math.PI / 2
    this.caneca.position.z = 1 * V
    this.caneca.visible = false
    this.maoDireita.add(this.caneca)
  }

  atualizarDados(dados) {
    this.dados = dados
    this.atualizarPlaca()
  }

  atualizarPlaca() {
    const dados = this.dados
    const rotulo = dados.tipoAgente === 'principal' ? 'Agente principal' : dados.nome || dados.descricao || dados.tipoAgente
    const tipo = dados.tipoAgente === 'principal' ? '' : `<span class="tipo-agente">${escaparHtml(dados.tipoAgente)}</span>`
    this.elementoPlaca.innerHTML = `${tipo}${escaparHtml(rotulo)}`
  }

  get posicao() {
    return this.grupo.position
  }

  posicionar(x, z) {
    this.grupo.position.set(x, 0, z)
    this.caminho = []
  }

  aparecer() {
    this.escalaAlvo = 1
  }

  desaparecer() {
    this.escalaAlvo = 0
  }

  get sumiu() {
    return this.escalaAlvo === 0 && this.corpo.scale.x < 0.02
  }

  get andando() {
    return this.caminho.length > 0
  }

  get travado() {
    return performance.now() < this.travadoAte
  }

  travar(ms) {
    this.travadoAte = Math.max(this.travadoAte, performance.now() + ms)
    this.caminho = []
  }

  seguirCaminho(pontosMundo) {
    this.caminho = pontosMundo.map(([x, z]) => new THREE.Vector3(x, 0, z))
  }

  olharPara(x, z) {
    this.direcaoAlvo = Math.atan2(x - this.posicao.x, z - this.posicao.z)
  }

  olharParaDirecao(angulo) {
    this.direcaoAlvo = angulo
  }

  definirPose(pose) {
    this.pose = pose
    this.atualizarObjetosNaMao()
  }

  atualizarObjetosNaMao() {
    const comCaneca = this.pose === 'tomandoCafe' && !this.objetoCarregado
    this.caneca.visible = comCaneca
    if (this.objetoDoTipo) this.objetoDoTipo.visible = !this.objetoCarregado && !comCaneca
  }

  correr(ms) {
    this.correndoAte = performance.now() + ms
  }

  tremer(ms) {
    this.tremendoAte = performance.now() + ms
  }

  carregar(tipoEntrega) {
    this.soltarCarga()
    const modelo = modeloEnvelope(tipoEntrega)
    this.objetoCarregado = criarMalha(modelo, [modelo.largura / 2, 0, modelo.profundidade / 2])
    this.objetoCarregado.rotation.x = Math.PI / 2
    this.objetoCarregado.position.z = 1.5 * V
    this.maoDireita.add(this.objetoCarregado)
    this.atualizarObjetosNaMao()
  }

  soltarCarga() {
    if (!this.objetoCarregado) return null
    const carga = this.objetoCarregado
    this.maoDireita.remove(carga)
    this.objetoCarregado = null
    this.atualizarObjetosNaMao()
    return carga
  }

  posicaoDaMaoNoMundo(destino = new THREE.Vector3()) {
    return this.maoDireita.getWorldPosition(destino)
  }

  mostrarBalao(texto, { duracaoMs = 0, prioritario = false } = {}) {
    const agora = performance.now()
    if (!prioritario && agora < this.balaoPrioritarioAte) return
    if (prioritario) this.balaoPrioritarioAte = agora + duracaoMs
    this.balaoExpiraEm = duracaoMs > 0 ? agora + duracaoMs : 0
    if (texto === this.textoBalao) return
    this.textoBalao = texto
    this.elementoBalao.textContent = texto
    this.elementoBalao.classList.toggle('oculto', texto === '')
  }

  esconderBalao() {
    if (performance.now() < this.balaoPrioritarioAte) return
    this.mostrarBalao('')
  }

  pontoAcimaDaCabeca(destino = new THREE.Vector3()) {
    return destino.set(this.posicao.x, this.posicao.y + ALTURA_CABECA * this.corpo.scale.y + this.corpo.position.y, this.posicao.z)
  }

  atualizar(segundos) {
    this.tempoAnimacao += segundos
    this.mover(segundos)
    this.direcao = interpolarAngulo(this.direcao, this.direcaoAlvo, Math.min(1, segundos * VELOCIDADE_GIRO))
    this.grupo.rotation.y = this.direcao
    const escala = aproximar(this.corpo.scale.x, this.escalaAlvo, Math.min(1, segundos * 9))
    this.corpo.scale.setScalar(Math.max(0.001, escala))
    this.animarPose()
    this.animarTremedeira()
    if (this.balaoExpiraEm > 0 && performance.now() > this.balaoExpiraEm) {
      this.balaoExpiraEm = 0
      this.balaoPrioritarioAte = 0
      this.mostrarBalao('')
    }
  }

  mover(segundos) {
    const correndo = performance.now() < this.correndoAte
    let restante = VELOCIDADE_CAMINHADA * (correndo ? MULTIPLICADOR_CORRIDA : 1) * segundos
    while (restante > 0 && this.caminho.length > 0) {
      const alvo = this.caminho[0]
      const delta = alvo.clone().sub(this.posicao)
      delta.y = 0
      const distancia = delta.length()
      if (distancia > 0.001) this.direcaoAlvo = Math.atan2(delta.x, delta.z)
      if (distancia <= restante) {
        this.posicao.copy(alvo)
        this.caminho.shift()
        restante -= distancia
      } else {
        this.posicao.addScaledVector(delta.normalize(), restante)
        restante = 0
      }
    }
  }

  animarPose() {
    const t = this.tempoAnimacao
    const pose = this.andando ? 'andando' : this.pose
    const alvo = { pernaE: 0, pernaD: 0, bracoE: 0, bracoD: 0, cabecaX: 0, cabecaZ: 0, alturaCorpo: 0, avancoCorpo: 0, bracoAbertura: 0 }

    switch (pose) {
      case 'andando': {
        const passo = Math.sin(t * 11)
        alvo.pernaE = passo * 0.65
        alvo.pernaD = -passo * 0.65
        alvo.bracoE = -passo * 0.55
        alvo.bracoD = this.objetoCarregado ? -0.9 : passo * 0.55
        alvo.alturaCorpo = Math.abs(Math.cos(t * 11)) * 0.8 * V
        break
      }
      case 'sentado':
      case 'digitando':
      case 'pensando':
      case 'aguardandoSentado':
      case 'cochilando':
        alvo.pernaE = -Math.PI / 2
        alvo.pernaD = -Math.PI / 2
        alvo.alturaCorpo = ALTURA_ASSENTO
        if (pose === 'digitando') {
          alvo.bracoE = -1.15 + Math.sin(t * 18) * 0.12
          alvo.bracoD = -1.15 + Math.sin(t * 18 + 1.7) * 0.12
          alvo.cabecaX = 0.12
        } else if (pose === 'pensando') {
          alvo.bracoD = -2.3
          alvo.bracoAbertura = 0.35
          alvo.cabecaZ = Math.sin(t * 1.4) * 0.12
          alvo.cabecaX = -0.15
        } else if (pose === 'cochilando') {
          const respiracao = Math.sin(t * 1.3)
          alvo.bracoE = -0.25
          alvo.bracoD = -0.25
          alvo.cabecaX = 0.55 + respiracao * 0.06
          alvo.cabecaZ = 0.18
          alvo.alturaCorpo = ALTURA_ASSENTO + respiracao * 0.3 * V
        } else if (pose === 'aguardandoSentado') {
          alvo.bracoE = -0.5
          alvo.bracoD = -0.5
          alvo.cabecaX = -0.1 + Math.sin(t * 2) * 0.05
        } else {
          alvo.bracoE = -0.6
          alvo.bracoD = -0.6
        }
        break
      case 'usando':
        alvo.bracoE = -1.1 + Math.sin(t * 5) * 0.15
        alvo.bracoD = -1.25 + Math.sin(t * 5 + 2) * 0.2
        alvo.cabecaX = 0.1
        break
      case 'escrevendoLousa':
        alvo.bracoD = -2.6 + Math.sin(t * 6) * 0.25
        alvo.bracoAbertura = Math.sin(t * 3) * 0.2
        alvo.bracoE = -0.2
        alvo.cabecaX = -0.2
        break
      case 'entregando':
        alvo.bracoD = -1.45
        break
      case 'tomandoCafe': {
        // Segura a caneca e, a cada ciclo, dá um gole com a cabeça para trás.
        const golinho = (t + this.id.length) % 4 > 2.9
        alvo.bracoD = golinho ? -2.5 : -1.3
        alvo.bracoE = -0.15
        alvo.cabecaX = golinho ? -0.3 : 0.05
        alvo.alturaCorpo = Math.sin(t * 2.2) * 0.25 * V
        break
      }
      case 'aguardando':
        alvo.bracoD = -2.9 + Math.sin(t * 8) * 0.3
        alvo.cabecaZ = Math.sin(t * 2) * 0.1
        break
      default:
        alvo.bracoE = Math.sin(t * 1.6) * 0.04
        alvo.bracoD = this.objetoCarregado ? -0.9 : -Math.sin(t * 1.6) * 0.04
        alvo.alturaCorpo = Math.sin(t * 2.2) * 0.25 * V
    }

    const fator = 0.25
    this.pernaEsquerda.rotation.x = aproximar(this.pernaEsquerda.rotation.x, alvo.pernaE, fator)
    this.pernaDireita.rotation.x = aproximar(this.pernaDireita.rotation.x, alvo.pernaD, fator)
    this.bracoEsquerdo.rotation.x = aproximar(this.bracoEsquerdo.rotation.x, alvo.bracoE, fator)
    this.bracoDireito.rotation.x = aproximar(this.bracoDireito.rotation.x, alvo.bracoD, fator)
    this.bracoDireito.rotation.z = aproximar(this.bracoDireito.rotation.z, alvo.bracoAbertura, fator)
    this.cabeca.rotation.x = aproximar(this.cabeca.rotation.x, alvo.cabecaX, fator)
    this.cabeca.rotation.z = aproximar(this.cabeca.rotation.z, alvo.cabecaZ, fator)
    this.corpo.position.y = aproximar(this.corpo.position.y, alvo.alturaCorpo, 0.3)
  }

  animarTremedeira() {
    const tremendo = performance.now() < this.tremendoAte
    this.corpo.position.x = tremendo ? (Math.random() - 0.5) * AMPLITUDE_TREMEDEIRA * 2 : 0
    this.corpo.position.z = tremendo ? (Math.random() - 0.5) * AMPLITUDE_TREMEDEIRA * 2 : 0
  }

  descartar() {
    this.elementoPlaca.remove()
    this.elementoBalao.remove()
    this.grupo.removeFromParent()
  }
}

export function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, caractere => `&#${caractere.charCodeAt(0)};`)
}
