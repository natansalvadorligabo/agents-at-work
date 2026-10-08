import * as THREE from 'three'

const GUINADA_PADRAO = Math.PI / 4
const INCLINACAO_PADRAO = 0.62
const INCLINACAO_MINIMA = 0.3
const INCLINACAO_MAXIMA = 1.25
const DISTANCIA_CAMERA = 60
const MARGEM_VISAO_GERAL = 1.12
const MARGEM_FOCO = 1.25
const MEIA_ALTURA_MINIMA_FOCO = 2.8
const LIMIAR_ARRASTO_PX = 4

export class ControleCamera {
  constructor(elemento) {
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200)
    this.guinada = GUINADA_PADRAO
    this.inclinacao = INCLINACAO_PADRAO
    this.centro = new THREE.Vector3(7, 0, 4.5)
    this.meiaAltura = 6
    this.proporcao = 1
    this.manual = false
    this.arrastou = false
    this.focos = []
    this.aoMudarModoManual = () => {}
    this.registrarInteracao(elemento)
  }

  ajustarProporcao(largura, altura) {
    this.proporcao = largura / Math.max(1, altura)
  }

  adicionarFoco(obterPontos, duracaoMs) {
    this.focos.push({ obterPontos, ate: performance.now() + duracaoMs })
  }

  recentralizar() {
    this.guinada = GUINADA_PADRAO
    this.inclinacao = INCLINACAO_PADRAO
    this.definirManual(false)
  }

  definirManual(manual) {
    if (this.manual === manual) return
    this.manual = manual
    this.aoMudarModoManual(manual)
  }

  registrarInteracao(elemento) {
    let inicio = null
    elemento.addEventListener('contextmenu', evento => evento.preventDefault())
    elemento.addEventListener('pointerdown', evento => {
      inicio = { x: evento.clientX, y: evento.clientY, ultimoX: evento.clientX, ultimoY: evento.clientY, botao: evento.button }
      this.arrastou = false
      elemento.setPointerCapture(evento.pointerId)
    })
    elemento.addEventListener('pointermove', evento => {
      if (!inicio) return
      const dx = evento.clientX - inicio.ultimoX
      const dy = evento.clientY - inicio.ultimoY
      inicio.ultimoX = evento.clientX
      inicio.ultimoY = evento.clientY
      if (!this.arrastou && Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y) < LIMIAR_ARRASTO_PX) return
      this.arrastou = true
      this.definirManual(true)
      if (inicio.botao === 2 || evento.shiftKey) this.deslocarCentro(dx, dy, elemento.clientHeight)
      else {
        this.guinada -= dx * 0.006
        this.inclinacao = THREE.MathUtils.clamp(this.inclinacao + dy * 0.004, INCLINACAO_MINIMA, INCLINACAO_MAXIMA)
      }
    })
    const encerrar = () => {
      inicio = null
      setTimeout(() => (this.arrastou = false), 0)
    }
    elemento.addEventListener('pointerup', encerrar)
    elemento.addEventListener('pointercancel', encerrar)
    elemento.addEventListener('wheel', evento => {
      evento.preventDefault()
      this.definirManual(true)
      this.meiaAltura = THREE.MathUtils.clamp(this.meiaAltura * Math.exp(evento.deltaY * 0.0012), 1.2, 30)
    }, { passive: false })
  }

  eixos() {
    const direcao = new THREE.Vector3(
      Math.sin(this.guinada) * Math.cos(this.inclinacao),
      Math.sin(this.inclinacao),
      Math.cos(this.guinada) * Math.cos(this.inclinacao),
    )
    const direita = new THREE.Vector3(Math.cos(this.guinada), 0, -Math.sin(this.guinada))
    const cima = new THREE.Vector3().crossVectors(direcao, direita).normalize()
    return { direcao, direita, cima }
  }

  deslocarCentro(dx, dy, alturaElemento) {
    const { direita, cima } = this.eixos()
    const unidadesPorPixel = (this.meiaAltura * 2) / Math.max(1, alturaElemento)
    this.centro.addScaledVector(direita, -dx * unidadesPorPixel)
    this.centro.addScaledVector(cima, dy * unidadesPorPixel)
  }

  enquadrar(pontos, margem, meiaAlturaMinima) {
    const { direita, cima } = this.eixos()
    let minDireita = Infinity, maxDireita = -Infinity, minCima = Infinity, maxCima = -Infinity
    for (const ponto of pontos) {
      const projecaoDireita = ponto.dot(direita)
      const projecaoCima = ponto.dot(cima)
      minDireita = Math.min(minDireita, projecaoDireita)
      maxDireita = Math.max(maxDireita, projecaoDireita)
      minCima = Math.min(minCima, projecaoCima)
      maxCima = Math.max(maxCima, projecaoCima)
    }
    const meioDireita = (minDireita + maxDireita) / 2
    const meioCima = (minCima + maxCima) / 2
    const referencia = pontos[0].clone()
    const ajusteDireita = meioDireita - referencia.dot(direita)
    const ajusteCima = meioCima - referencia.dot(cima)
    const centro = referencia.addScaledVector(direita, ajusteDireita).addScaledVector(cima, ajusteCima)
    const meiaAltura = Math.max(meiaAlturaMinima, Math.max((maxCima - minCima) / 2, (maxDireita - minDireita) / 2 / this.proporcao) * margem)
    return { centro, meiaAltura }
  }

  pontosDaSala({ largura, profundidade, altura }) {
    const pontos = []
    for (const x of [0, largura]) for (const z of [0, profundidade]) for (const y of [0, altura]) pontos.push(new THREE.Vector3(x, y, z))
    return pontos
  }

  pontosDosFocos(agora) {
    this.focos = this.focos.filter(foco => foco.ate > agora)
    const pontos = []
    for (const foco of this.focos) {
      for (const posicao of foco.obterPontos()) {
        pontos.push(posicao.clone(), posicao.clone().setY(1.5))
      }
    }
    return pontos
  }

  atualizar(segundos, limitesSala) {
    const pontosFoco = this.pontosDosFocos(performance.now())
    if (!this.manual) {
      const alvo = pontosFoco.length > 0
        ? this.enquadrar(pontosFoco, MARGEM_FOCO, MEIA_ALTURA_MINIMA_FOCO)
        : this.enquadrar(this.pontosDaSala(limitesSala), MARGEM_VISAO_GERAL, 0)
      const suavizacao = 1 - Math.exp(-segundos * 2.6)
      this.centro.lerp(alvo.centro, suavizacao)
      this.meiaAltura += (alvo.meiaAltura - this.meiaAltura) * suavizacao
    }

    const { direcao } = this.eixos()
    this.camera.position.copy(this.centro).addScaledVector(direcao, DISTANCIA_CAMERA)
    this.camera.lookAt(this.centro)
    this.camera.top = this.meiaAltura
    this.camera.bottom = -this.meiaAltura
    this.camera.left = -this.meiaAltura * this.proporcao
    this.camera.right = this.meiaAltura * this.proporcao
    this.camera.updateProjectionMatrix()
  }
}
