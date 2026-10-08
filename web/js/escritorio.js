import * as THREE from 'three'
import { criarMalha } from './voxel.js'
import {
  modeloBatentePorta,
  modeloCadeira,
  modeloEnvelope,
  modeloEstante,
  modeloFolhaPorta,
  modeloJanela,
  modeloLedsRack,
  modeloLousa,
  modeloMesa,
  modeloMesaGlobo,
  modeloMesaTelefone,
  modeloRack,
  modeloVaso,
} from './modelos.js'
import { GradeDeCaminhos } from './caminhos.js'
import { FiguraAgente } from './personagem.js'
import { ControladorAgente } from './comportamento.js'
import { ControleCamera } from './camera.js'

const PROFUNDIDADE_SALA = 9
const LARGURA_MINIMA_SALA = 14
const ALTURA_PAREDE = 2.6
const ESPESSURA_PAREDE = 0.2
const LINHA_PORTA = 6
const PRIMEIRA_COLUNA_MESAS = 5
const ESPACAMENTO_COLUNAS_MESAS = 3
const LINHAS_MESAS = [3, 6]
const MESA_PRINCIPAL = { x: 1, z: 3 }
const AGENTE_PRINCIPAL = 'principal'
const DURACAO_VOO_ENTREGA_MS = 750
const QUANTIDADE_MAXIMA_LADRILHOS = 4096
const DISTANCIA_MINIMA_ENTRE_FIGURAS = 0.55
const OCIOSIDADE_PADRAO_MS = 45000
const ILUMINACAO = {
  normal: { ambiente: 1.6, sol: 2.1, fundo: 0x1d2230 },
  ociosa: { ambiente: 0.28, sol: 0.1, fundo: 0x0c0f17 },
  encerrada: { ambiente: 0.18, sol: 0.05, fundo: 0x07090e },
}

const TILES_BLOQUEADOS_FIXOS = [
  [0, 0], [1, 0], [3, 0], [4, 0], [6, 0], [8, 0], [10, 0], [12, 0], [0, 8],
]

export class Escritorio {
  constructor(conteiner, camadaHtml, { ociosidadeMs = OCIOSIDADE_PADRAO_MS } = {}) {
    this.ociosidadeMs = ociosidadeMs
    this.ultimaAtividade = performance.now()
    this.encerrada = false
    this.conteiner = conteiner
    this.camadaHtml = camadaHtml
    this.figuras = new Map()
    this.controladores = new Map()
    this.vagasPorAgente = new Map()
    this.mesasPorVaga = new Map()
    this.voosEntrega = []
    this.largura = LARGURA_MINIMA_SALA
    this.grade = new GradeDeCaminhos(this.largura, PROFUNDIDADE_SALA)
    this.aoSelecionar = () => {}

    this.renderizador = new THREE.WebGLRenderer({ antialias: false, alpha: false })
    this.renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderizador.shadowMap.enabled = true
    this.renderizador.shadowMap.type = THREE.PCFShadowMap
    conteiner.append(this.renderizador.domElement)

    this.cena = new THREE.Scene()
    this.cena.background = new THREE.Color(0x1d2230)
    this.camera = new ControleCamera(this.renderizador.domElement)
    this.criarIluminacao()
    this.criarSalaFixa()
    this.atualizarSala(true)
    this.criarAgentePrincipal()

    this.raycaster = new THREE.Raycaster()
    this.renderizador.domElement.addEventListener('click', evento => this.selecionarNoClique(evento))
    window.addEventListener('resize', () => this.ajustarTamanho())
    this.ajustarTamanho()
    this.ultimoQuadro = performance.now()
    this.renderizador.setAnimationLoop(() => this.quadro())
  }

  criarIluminacao() {
    this.luzAmbiente = new THREE.HemisphereLight(0xfff4e0, 0x3a3f55, 1.6)
    this.cena.add(this.luzAmbiente)
    this.luzSol = new THREE.DirectionalLight(0xffffff, 2.1)
    this.luzSol.position.set(18, 22, 14)
    this.luzSol.castShadow = true
    this.luzSol.shadow.mapSize.set(2048, 2048)
    this.luzSol.shadow.bias = -0.0008
    this.luzSol.shadow.normalBias = 0.02
    this.cena.add(this.luzSol, this.luzSol.target)
  }

  ajustarSombraALargura() {
    const sombra = this.luzSol.shadow.camera
    const meiaLargura = Math.max(this.largura, PROFUNDIDADE_SALA) * 0.85
    Object.assign(sombra, { left: -meiaLargura, right: meiaLargura, top: meiaLargura, bottom: -meiaLargura, near: 1, far: 80 })
    sombra.updateProjectionMatrix()
    this.luzSol.target.position.set(this.largura / 2, 0, PROFUNDIDADE_SALA / 2)
    this.luzSol.position.set(this.largura / 2 + 12, 24, PROFUNDIDADE_SALA / 2 + 14)
  }

  criarSalaFixa() {
    const ladrilho = new THREE.BoxGeometry(1, 0.08, 1)
    this.piso = new THREE.InstancedMesh(ladrilho, new THREE.MeshLambertMaterial(), QUANTIDADE_MAXIMA_LADRILHOS)
    this.piso.receiveShadow = true
    this.piso.count = 0
    this.cena.add(this.piso)

    const materialParede = new THREE.MeshLambertMaterial({ color: 0xe6dccb })
    const materialRodape = new THREE.MeshLambertMaterial({ color: 0x8c6b4a })
    this.paredeFundo = new THREE.Mesh(new THREE.BoxGeometry(1, ALTURA_PAREDE, ESPESSURA_PAREDE), materialParede)
    this.rodapeFundo = new THREE.Mesh(new THREE.BoxGeometry(1, 0.18, ESPESSURA_PAREDE + 0.04), materialRodape)
    for (const malha of [this.paredeFundo, this.rodapeFundo]) {
      malha.receiveShadow = true
      this.cena.add(malha)
    }

    const paredeEsquerda = (z0, z1) => {
      const comprimento = z1 - z0
      const parede = new THREE.Mesh(new THREE.BoxGeometry(ESPESSURA_PAREDE, ALTURA_PAREDE, comprimento), materialParede)
      parede.position.set(-ESPESSURA_PAREDE / 2, ALTURA_PAREDE / 2, z0 + comprimento / 2)
      const rodape = new THREE.Mesh(new THREE.BoxGeometry(ESPESSURA_PAREDE + 0.04, 0.18, comprimento), materialRodape)
      rodape.position.set(-ESPESSURA_PAREDE / 2, 0.09, z0 + comprimento / 2)
      parede.receiveShadow = true
      this.cena.add(parede, rodape)
    }
    paredeEsquerda(-ESPESSURA_PAREDE, LINHA_PORTA)
    paredeEsquerda(LINHA_PORTA + 1, PROFUNDIDADE_SALA)
    const vergaPorta = new THREE.Mesh(new THREE.BoxGeometry(ESPESSURA_PAREDE, ALTURA_PAREDE - 2.2, 1), materialParede)
    vergaPorta.position.set(-ESPESSURA_PAREDE / 2, 2.2 + (ALTURA_PAREDE - 2.2) / 2, LINHA_PORTA + 0.5)
    this.cena.add(vergaPorta)

    const colocar = (modelo, x, y, z, rotacaoY = 0) => {
      const malha = criarMalha(modelo, [modelo.largura / 2, 0, modelo.profundidade / 2])
      malha.position.set(x, y, z)
      malha.rotation.y = rotacaoY
      this.cena.add(malha)
      return malha
    }

    colocar(modeloEstante(), 1.0, 0, 0.32)
    colocar(modeloLousa(), 4.0, 0, 0.2)
    colocar(modeloRack(), 6.5, 0, 0.42)
    this.ledsRack = criarMalha(modeloLedsRack(), [8, 0, 0])
    this.ledsRack.material = new THREE.MeshBasicMaterial({ vertexColors: true })
    this.ledsRack.position.set(6.5, 0, 0.42 + 6 / 16 + 0.002)
    this.ledsRack.castShadow = false
    this.cena.add(this.ledsRack)
    colocar(modeloJanela(), 8.5, 0.9, 0.02)
    colocar(modeloMesaGlobo(), 8.5, 0, 0.5)
    colocar(modeloMesaTelefone(), 10.5, 0, 0.42)
    colocar(modeloVaso(), 12.5, 0, 0.45)
    colocar(modeloVaso(), 0.5, 0, 8.45)

    const batente = colocar(modeloBatentePorta(), -0.1, 0, LINHA_PORTA + 0.5)
    batente.castShadow = false
    const folha = modeloFolhaPorta()
    this.folhaPorta = new THREE.Group()
    this.folhaPorta.position.set(-0.05, 0, LINHA_PORTA + 0.03)
    const malhaFolha = criarMalha(folha, [1, 0, 0])
    this.folhaPorta.add(malhaFolha)
    this.cena.add(this.folhaPorta)

    const mesaPrincipal = this.criarConjuntoMesa()
    mesaPrincipal.position.set(MESA_PRINCIPAL.x + 1, 0, MESA_PRINCIPAL.z + 0.5)
    mesaPrincipal.scale.setScalar(1)
    this.cena.add(mesaPrincipal)
  }

  criarConjuntoMesa() {
    const conjunto = new THREE.Group()
    const mesa = criarMalha(modeloMesa(), [14, 0, 7])
    const cadeira = criarMalha(modeloCadeira(), [5, 0, 5])
    cadeira.position.set(0, 0, 0.95)
    conjunto.add(mesa, cadeira)
    conjunto.userData.escalaAlvo = 1
    conjunto.scale.setScalar(0.001)
    return conjunto
  }

  posicaoDaVaga(vaga) {
    const coluna = Math.floor(vaga / LINHAS_MESAS.length)
    const linha = LINHAS_MESAS[vaga % LINHAS_MESAS.length]
    return { x: PRIMEIRA_COLUNA_MESAS + coluna * ESPACAMENTO_COLUNAS_MESAS, z: linha }
  }

  larguraNecessaria() {
    let maiorColuna = -1
    for (const vaga of this.mesasPorVaga.keys()) maiorColuna = Math.max(maiorColuna, Math.floor(vaga / LINHAS_MESAS.length))
    return Math.max(LARGURA_MINIMA_SALA, PRIMEIRA_COLUNA_MESAS + (maiorColuna + 1) * ESPACAMENTO_COLUNAS_MESAS + 1)
  }

  atualizarSala(forcar = false) {
    const largura = this.larguraNecessaria()
    if (!forcar && largura === this.largura) {
      this.recalcularBloqueios()
      return
    }
    this.largura = largura
    this.grade.redimensionar(largura, PROFUNDIDADE_SALA)
    this.recalcularBloqueios()

    const matriz = new THREE.Matrix4()
    const cor = new THREE.Color()
    let indice = 0
    for (let z = 0; z < PROFUNDIDADE_SALA; z++)
      for (let x = 0; x < largura; x++) {
        matriz.makeTranslation(x + 0.5, -0.04, z + 0.5)
        this.piso.setMatrixAt(indice, matriz)
        cor.setHex((x + z) % 2 === 0 ? 0xd8b98a : 0xcdac7c)
        this.piso.setColorAt(indice, cor)
        indice++
      }
    this.piso.count = indice
    this.piso.instanceMatrix.needsUpdate = true
    if (this.piso.instanceColor) this.piso.instanceColor.needsUpdate = true

    const comprimentoFundo = largura + ESPESSURA_PAREDE
    for (const malha of [this.paredeFundo, this.rodapeFundo]) malha.scale.x = comprimentoFundo
    this.paredeFundo.position.set(largura / 2 - ESPESSURA_PAREDE / 2, ALTURA_PAREDE / 2, -ESPESSURA_PAREDE / 2)
    this.rodapeFundo.position.set(largura / 2 - ESPESSURA_PAREDE / 2, 0.09, -ESPESSURA_PAREDE / 2)
    this.ajustarSombraALargura()
  }

  recalcularBloqueios() {
    this.grade.limparBloqueios()
    for (const [x, z] of TILES_BLOQUEADOS_FIXOS) this.grade.bloquear(x, z)
    this.grade.bloquear(MESA_PRINCIPAL.x, MESA_PRINCIPAL.z)
    this.grade.bloquear(MESA_PRINCIPAL.x + 1, MESA_PRINCIPAL.z)
    for (const vaga of this.mesasPorVaga.keys()) {
      const { x, z } = this.posicaoDaVaga(vaga)
      this.grade.bloquear(x, z)
      this.grade.bloquear(x + 1, z)
    }
  }

  limitesDaSala() {
    return { largura: this.largura, profundidade: PROFUNDIDADE_SALA, altura: ALTURA_PAREDE }
  }

  ocuparVaga(agenteId) {
    if (this.vagasPorAgente.has(agenteId)) return this.vagasPorAgente.get(agenteId)
    let vaga = 0
    while (this.mesasPorVaga.has(vaga)) vaga++
    const conjunto = this.criarConjuntoMesa()
    const { x, z } = this.posicaoDaVaga(vaga)
    conjunto.position.set(x + 1, 0, z + 0.5)
    this.cena.add(conjunto)
    this.mesasPorVaga.set(vaga, conjunto)
    this.vagasPorAgente.set(agenteId, vaga)
    this.atualizarSala()
    return vaga
  }

  liberarVaga(agenteId) {
    const vaga = this.vagasPorAgente.get(agenteId)
    if (vaga === undefined) return
    this.vagasPorAgente.delete(agenteId)
    const conjunto = this.mesasPorVaga.get(vaga)
    conjunto.userData.escalaAlvo = 0
    conjunto.userData.aoSumir = () => {
      conjunto.removeFromParent()
      this.mesasPorVaga.delete(vaga)
      this.atualizarSala()
    }
  }

  assentoDoAgente(agenteId) {
    if (agenteId === AGENTE_PRINCIPAL) return [MESA_PRINCIPAL.x + 1, MESA_PRINCIPAL.z + 1.3]
    const vaga = this.vagasPorAgente.get(agenteId)
    if (vaga === undefined) return this.pontoDentroDaPorta()
    const { x, z } = this.posicaoDaVaga(vaga)
    return [x + 1, z + 1.3]
  }

  pontoDentroDaPorta() {
    return [0.5, LINHA_PORTA + 0.5]
  }

  pontoForaDaPorta() {
    return [-1.1, LINHA_PORTA + 0.5]
  }

  planejarCaminho(posicao, destino) {
    const dentroDaSala = (x, z) => x >= 0 && z >= 0 && x < this.largura && z < PROFUNDIDADE_SALA
    const [entradaX, entradaZ] = this.pontoDentroDaPorta()
    const pontos = []
    let origem = [posicao.x, posicao.z]
    if (!dentroDaSala(...origem)) {
      pontos.push([entradaX, entradaZ])
      origem = [entradaX, entradaZ]
    }
    const destinoInterno = dentroDaSala(...destino) ? destino : [entradaX, entradaZ]
    const celulas = this.grade.encontrarCaminho(
      [Math.floor(origem[0]), Math.floor(origem[1])],
      [Math.floor(destinoInterno[0]), Math.floor(destinoInterno[1])],
    )
    for (const [x, z] of celulas.slice(0, -1)) pontos.push([x + 0.5, z + 0.5])
    pontos.push(destinoInterno)
    if (destinoInterno !== destino) pontos.push(destino)
    return pontos
  }

  criarAgentePrincipal() {
    this.adicionarFigura(
      { id: AGENTE_PRINCIPAL, tipoAgente: 'principal', descricao: 'Agente principal', estado: 'aguardando', ferramentasAtivas: {}, historico: [] },
      { restaurado: true },
    )
  }

  adicionarFigura(dados, { restaurado = false } = {}) {
    this.registrarAtividade()
    if (this.figuras.has(dados.id)) return this.figuras.get(dados.id)
    if (dados.id !== AGENTE_PRINCIPAL) this.ocuparVaga(dados.id)
    const figura = new FiguraAgente(dados, this.camadaHtml)
    const controlador = new ControladorAgente(figura, this)
    this.figuras.set(dados.id, figura)
    this.controladores.set(dados.id, controlador)
    this.cena.add(figura.grupo)
    if (restaurado) {
      controlador.sentarImediatamente()
      figura.aparecer()
    } else {
      controlador.iniciarChegada(dados.paiId ?? AGENTE_PRINCIPAL)
    }
    return figura
  }

  removerFigura(agenteId) {
    const figura = this.figuras.get(agenteId)
    if (!figura) return
    figura.descartar()
    this.figuras.delete(agenteId)
    this.controladores.delete(agenteId)
    this.liberarVaga(agenteId)
  }

  limparTudo() {
    for (const agenteId of [...this.figuras.keys()]) {
      const figura = this.figuras.get(agenteId)
      figura.descartar()
      this.figuras.delete(agenteId)
      this.controladores.delete(agenteId)
      const vaga = this.vagasPorAgente.get(agenteId)
      if (vaga !== undefined) {
        this.mesasPorVaga.get(vaga)?.removeFromParent()
        this.mesasPorVaga.delete(vaga)
        this.vagasPorAgente.delete(agenteId)
      }
    }
    for (const voo of this.voosEntrega) voo.malha.removeFromParent()
    this.voosEntrega = []
    this.atualizarSala(true)
  }

  figuraDoPai(paiId, filhoId) {
    const pai = this.figuras.get(paiId)
    if (pai && pai.id !== filhoId && !this.controladores.get(paiId)?.saindo) return pai
    return this.figuras.get(AGENTE_PRINCIPAL)
  }

  receberDadosDoAgente(dados) {
    this.registrarAtividade()
    const figura = this.figuras.get(dados.id)
    if (figura) figura.atualizarDados(dados)
    return figura
  }

  concluirAgente(dados) {
    this.registrarAtividade()
    const controlador = this.controladores.get(dados.id)
    if (!controlador) return
    controlador.figura.atualizarDados(dados)
    controlador.iniciarRetorno(dados.paiId ?? AGENTE_PRINCIPAL, dados.estado === 'concluido')
  }

  animarEntrega(remetente, destinatario, tipoEntrega) {
    remetente.soltarCarga()
    const modelo = modeloEnvelope(tipoEntrega)
    const malha = criarMalha(modelo, [modelo.largura / 2, 0, modelo.profundidade / 2])
    malha.scale.setScalar(1.6)
    const origem = remetente.posicaoDaMaoNoMundo()
    malha.position.copy(origem)
    this.cena.add(malha)
    return new Promise(resolver => {
      this.voosEntrega.push({ malha, remetente, destinatario, inicio: performance.now(), origem, tipoEntrega, resolver })
    })
  }

  atualizarVoosEntrega(agora) {
    const destino = new THREE.Vector3()
    this.voosEntrega = this.voosEntrega.filter(voo => {
      const progresso = Math.min(1, (agora - voo.inicio) / DURACAO_VOO_ENTREGA_MS)
      voo.destinatario.posicaoDaMaoNoMundo(destino)
      voo.malha.position.lerpVectors(voo.origem, destino, progresso)
      voo.malha.position.y += Math.sin(progresso * Math.PI) * 0.55
      voo.malha.rotation.y = progresso * Math.PI * 2
      if (progresso < 1) return true
      voo.malha.removeFromParent()
      voo.destinatario.carregar(voo.tipoEntrega)
      voo.resolver()
      return false
    })
  }

  focarEm(figuras, duracaoMs) {
    this.camera.adicionarFoco(() => figuras.map(figura => figura.posicao), duracaoMs)
  }

  definirSessaoEncerrada(encerrada) {
    this.encerrada = encerrada
  }

  registrarAtividade() {
    this.ultimaAtividade = performance.now()
  }

  get ocioso() {
    const principal = this.figuras.get(AGENTE_PRINCIPAL)
    const algumEmRoteiro = [...this.controladores.values()].some(controlador => controlador.emRoteiro || controlador.saindo)
    return !algumEmRoteiro && principal?.dados.estado === 'aguardando' && performance.now() - this.ultimaAtividade > this.ociosidadeMs
  }

  ajustarIluminacao(segundos) {
    const alvo = this.encerrada ? ILUMINACAO.encerrada : this.ocioso ? ILUMINACAO.ociosa : ILUMINACAO.normal
    const suavizacao = 1 - Math.exp(-segundos * 1.8)
    this.luzAmbiente.intensity += (alvo.ambiente - this.luzAmbiente.intensity) * suavizacao
    this.luzSol.intensity += (alvo.sol - this.luzSol.intensity) * suavizacao
    this.cena.background.lerp(new THREE.Color(alvo.fundo), suavizacao)
  }

  selecionarNoClique(evento) {
    if (this.camera.arrastou) return
    const area = this.renderizador.domElement.getBoundingClientRect()
    const ponteiro = new THREE.Vector2(((evento.clientX - area.left) / area.width) * 2 - 1, -((evento.clientY - area.top) / area.height) * 2 + 1)
    this.raycaster.setFromCamera(ponteiro, this.camera.camera)
    const grupos = [...this.figuras.values()].map(figura => figura.grupo)
    const [acerto] = this.raycaster.intersectObjects(grupos, true)
    let objeto = acerto?.object
    while (objeto && !objeto.userData.figura) objeto = objeto.parent
    this.aoSelecionar(objeto?.userData.figura?.id ?? null)
  }

  ajustarTamanho() {
    const { clientWidth: largura, clientHeight: altura } = this.conteiner
    this.renderizador.setSize(largura, altura)
    this.camera.ajustarProporcao(largura, altura)
  }

  animarConjuntosMesa(segundos) {
    for (const conjunto of this.mesasPorVaga.values()) {
      const alvo = conjunto.userData.escalaAlvo
      const atual = conjunto.userData.escalaAtual ?? 0
      if (atual === alvo) continue
      const crescendo = alvo > atual
      const proxima = crescendo ? Math.min(alvo, atual + segundos * 2.4) : Math.max(0, atual - segundos * 3)
      conjunto.userData.escalaAtual = proxima
      const ressalto = crescendo && proxima < 1 ? Math.sin(proxima * Math.PI) * 0.18 : 0
      const escala = Math.max(0.001, proxima)
      conjunto.scale.set(escala + ressalto * 0.5, escala + ressalto, escala + ressalto * 0.5)
      if (alvo === 0 && proxima === 0) conjunto.userData.aoSumir?.()
    }
  }

  animarPorta() {
    const alguemPerto = [...this.figuras.values()].some(figura => Math.hypot(figura.posicao.x + 0.2, figura.posicao.z - (LINHA_PORTA + 0.5)) < 1.3)
    const alvo = alguemPerto ? -1.35 : 0
    this.folhaPorta.rotation.y += (alvo - this.folhaPorta.rotation.y) * 0.15
  }

  afastarFigurasSobrepostas(segundos) {
    const moveis = [...this.controladores.values()].filter(controlador => !controlador.sentado && !controlador.figura.travado)
    for (let i = 0; i < moveis.length; i++)
      for (let j = i + 1; j < moveis.length; j++) {
        const a = moveis[i].figura.posicao
        const b = moveis[j].figura.posicao
        const dx = b.x - a.x
        const dz = b.z - a.z
        const distancia = Math.hypot(dx, dz)
        if (distancia >= DISTANCIA_MINIMA_ENTRE_FIGURAS) continue
        const angulo = distancia > 0.001 ? Math.atan2(dz, dx) : i + j
        const empurrao = Math.min(DISTANCIA_MINIMA_ENTRE_FIGURAS - distancia, segundos * 1.5) / 2
        a.x -= Math.cos(angulo) * empurrao
        a.z -= Math.sin(angulo) * empurrao
        b.x += Math.cos(angulo) * empurrao
        b.z += Math.sin(angulo) * empurrao
      }
  }

  posicionarCamadaHtml() {
    const ponto = new THREE.Vector3()
    const { clientWidth: largura, clientHeight: altura } = this.conteiner
    for (const figura of this.figuras.values()) {
      figura.pontoAcimaDaCabeca(ponto).project(this.camera.camera)
      const x = (ponto.x * 0.5 + 0.5) * largura
      const y = (-ponto.y * 0.5 + 0.5) * altura
      const visivel = figura.corpo.scale.x > 0.3
      figura.elementoPlaca.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`
      figura.elementoBalao.style.transform = `translate(-50%, -100%) translate(${x}px, ${y - 22}px)`
      figura.elementoPlaca.style.opacity = visivel ? '1' : '0'
      figura.elementoBalao.style.opacity = visivel ? '1' : '0'
    }
  }

  quadro() {
    const agora = performance.now()
    const segundos = Math.min(0.1, (agora - this.ultimoQuadro) / 1000)
    this.ultimoQuadro = agora
    for (const controlador of this.controladores.values()) controlador.atualizar(agora)
    for (const figura of this.figuras.values()) figura.atualizar(segundos)
    this.afastarFigurasSobrepostas(segundos)
    this.atualizarVoosEntrega(agora)
    this.animarConjuntosMesa(segundos)
    this.animarPorta()
    this.ajustarIluminacao(segundos)
    this.ledsRack.visible = Math.floor(agora / 420) % 5 !== 0
    this.camera.atualizar(segundos, this.limitesDaSala())
    this.renderizador.render(this.cena, this.camera.camera)
    this.posicionarCamadaHtml()
  }
}

export { AGENTE_PRINCIPAL }
