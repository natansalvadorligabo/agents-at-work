import { ESTACOES, categoriaDaFerramenta, textoDoBalaoDaFerramenta } from './atividades.js'
import {
  CAFES_PARA_ESTAR_OTIMO,
  DIRECAO_CAFETEIRA,
  DURACAO_TREMEDEIRA_MS,
  LIMIAR_COMPILANDO_MS,
  LIMIAR_DELEGACAO_MS,
  textoCompilando,
  textoEstouOtimo,
  textoSupervisionando,
} from './cafe.js'

const ATRASO_PARA_DESLOCAR_MS = 400
const PERMANENCIA_APOS_FERRAMENTA_MS = 1500
const PENSAMENTO_LONGO_MS = 5000
const DISTANCIA_CONVERSA = 0.85
const INTERVALO_REPLANEJAMENTO_MS = 450
const DURACAO_CONVERSA_MS = 2600
const DURACAO_FOCO_ENTREGA_MS = 3800
const ESPERA_EXTRA_ENTREGA_NO_CAFE_MS = 1200
const DURACAO_CORRIDA_MS = 5000
const FERRAMENTAS_DE_DELEGACAO = /^(Agent|Task)$/

function esperar(ms) {
  return new Promise(resolver => setTimeout(resolver, ms))
}

function distanciaPlana(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

export class ControladorAgente {
  constructor(figura, escritorio) {
    this.figura = figura
    this.escritorio = escritorio
    this.emRoteiro = false
    this.filaRoteiros = Promise.resolve()
    this.alvoAtual = null
    this.chegouAoAlvo = false
    this.deslocamento = null
    this.inicioPensamento = 0
    this.estavaPensando = false
    this.saindo = false
    this.noCafe = false
    this.cafeAtual = null
    this.inicioEsperaDelegacao = 0
    this.parceiroConversa = null
    this.conversaAte = 0
  }

  get sentado() {
    return this.chegouAoAlvo && this.alvoAtual === 'mesa' && !this.emRoteiro
  }

  get disponivelParaFofoca() {
    return this.noCafe && !this.emRoteiro && !this.saindo && !this.figura.travado && !this.figura.objetoCarregado && performance.now() > this.conversaAte
  }

  conversarCom(figura, duracaoMs) {
    this.parceiroConversa = figura
    this.conversaAte = performance.now() + duracaoMs
  }

  // Conta também quem já está voltando: o chefe só larga o café depois de receber todas as entregas.
  quantidadeDeFilhos() {
    let quantidade = 0
    for (const controlador of this.escritorio.controladores.values())
      if (controlador !== this && controlador.dados.paiId === this.figura.id) quantidade++
    return quantidade
  }

  motivoParaCafe(ferramentaAtual, instanteAtual) {
    if (ferramentaAtual) {
      const categoria = categoriaDaFerramenta(ferramentaAtual.ferramenta)
      if (categoria.estacao === 'rack' && instanteAtual - ferramentaAtual.inicio >= LIMIAR_COMPILANDO_MS) {
        return { motivo: 'compilando', ferramentaId: ferramentaAtual.id, balao: textoCompilando(ferramentaAtual) }
      }
      if (!FERRAMENTAS_DE_DELEGACAO.test(ferramentaAtual.ferramenta)) {
        this.inicioEsperaDelegacao = 0
        return null
      }
    } else if (this.dados.pensando) {
      this.inicioEsperaDelegacao = 0
      return null
    }
    const filhos = this.quantidadeDeFilhos()
    if (filhos === 0) {
      this.inicioEsperaDelegacao = 0
      return null
    }
    if (!this.inicioEsperaDelegacao) this.inicioEsperaDelegacao = instanteAtual
    if (instanteAtual - this.inicioEsperaDelegacao < LIMIAR_DELEGACAO_MS && this.alvoAtual !== 'cafe') return null
    return { motivo: 'delegou', balao: textoSupervisionando(filhos) }
  }

  chegarAoCafe() {
    this.noCafe = true
    const cafes = this.escritorio.registrarChegadaCafe(this.figura)
    if (cafes < CAFES_PARA_ESTAR_OTIMO) return
    this.figura.tremer(DURACAO_TREMEDEIRA_MS)
    this.figura.mostrarBalao(textoEstouOtimo(cafes), { duracaoMs: 3500, prioritario: true })
  }

  sairDoCafe() {
    if (this.noCafe) this.escritorio.registrarSaidaCafe(this.figura.id)
    this.noCafe = false
    this.cafeAtual = null
    this.parceiroConversa = null
    this.conversaAte = 0
    this.escritorio.liberarVagaCafe(this.figura.id)
  }

  // O comando longo que mandou o agente para o café terminou; se falhou, ele volta correndo e derruba o café.
  verificarFimDoCafe() {
    const cafe = this.cafeAtual
    if (!cafe || cafe.motivo !== 'compilando') return false
    const registro = this.dados.historico?.find(item => item.id === cafe.ferramentaId)
    if (!registro?.fim) return false
    this.cafeAtual = null
    if (!registro.erro || !this.noCafe) return false
    this.derrubarCafe()
    return true
  }

  derrubarCafe() {
    const figura = this.figura
    const { x, z } = figura.posicao
    this.enfileirarRoteiro(async () => {
      figura.definirPose('emPe')
      figura.mostrarBalao('💥☕ DERRUBEI O CAFÉ! o comando falhou!', { duracaoMs: 2800, prioritario: true })
      this.escritorio.criarPocaCafe(x + 0.2, z)
      this.escritorio.focarEm([figura], 2500)
      await esperar(600)
      figura.correr(DURACAO_CORRIDA_MS)
      await this.andarAte(() => this.escritorio.assentoDoAgente(figura.id))
      figura.olharParaDirecao(Math.PI)
    })
  }

  get dados() {
    return this.figura.dados
  }

  enfileirarRoteiro(roteiro) {
    this.filaRoteiros = this.filaRoteiros
      .then(async () => {
        this.emRoteiro = true
        if (this.alvoAtual === 'cafe') this.sairDoCafe()
        this.alvoAtual = null
        await roteiro()
      })
      .catch(erro => console.error('roteiro interrompido', erro))
      .finally(() => {
        this.emRoteiro = false
      })
    return this.filaRoteiros
  }

  andarAte(obterPonto, { distanciaParada = 0.05 } = {}) {
    return new Promise(resolver => {
      this.deslocamento = { obterPonto, distanciaParada, resolver, ultimoPlanejamento: 0, ultimoPonto: null }
    })
  }

  atualizarDeslocamento(agora) {
    const deslocamento = this.deslocamento
    if (!deslocamento) return
    const figura = this.figura
    if (figura.travado) return
    const ponto = deslocamento.obterPonto()
    const destino = { x: ponto[0], z: ponto[1] }
    if (distanciaPlana(figura.posicao, destino) <= Math.max(deslocamento.distanciaParada, 0.02)) {
      figura.caminho = []
      this.deslocamento = null
      deslocamento.resolver()
      return
    }
    const alvoMudou = !deslocamento.ultimoPonto || distanciaPlana(deslocamento.ultimoPonto, destino) > 0.5
    const precisaReplanejar = !figura.andando || (alvoMudou && agora - deslocamento.ultimoPlanejamento > INTERVALO_REPLANEJAMENTO_MS)
    if (!precisaReplanejar) return
    deslocamento.ultimoPlanejamento = agora
    deslocamento.ultimoPonto = destino
    const pontos = this.escritorio.planejarCaminho(figura.posicao, ponto)
    if (deslocamento.distanciaParada > 0.1) {
      const alcance = this.pontosAteAlcance(pontos, destino, deslocamento.distanciaParada)
      figura.seguirCaminho(alcance)
      if (alcance.length === 0) {
        this.deslocamento = null
        deslocamento.resolver()
      }
    } else {
      figura.seguirCaminho(pontos)
    }
  }

  pontosAteAlcance(pontos, destino, distanciaParada) {
    const resultado = []
    for (const ponto of pontos) {
      resultado.push(ponto)
      if (Math.hypot(ponto[0] - destino.x, ponto[1] - destino.z) <= distanciaParada) break
    }
    return resultado
  }

  atualizar(agora) {
    this.atualizarDeslocamento(agora)
    if (this.emRoteiro || this.saindo || this.figura.travado) return
    this.atualizarAtividadeLivre(agora)
  }

  atualizarAtividadeLivre(agora) {
    if (this.verificarFimDoCafe()) return
    const dados = this.dados
    const figura = this.figura
    const instanteAtual = Date.now()

    if (dados.pensando && !this.estavaPensando) this.inicioPensamento = instanteAtual
    this.estavaPensando = dados.pensando

    const ativas = Object.values(dados.ferramentasAtivas ?? {}).sort((a, b) => b.inicio - a.inicio)
    const ferramentaAtual = ativas[0]
    const motivoCafe = this.motivoParaCafe(ferramentaAtual, instanteAtual)
    let alvo = 'mesa'
    let pose = 'sentado'
    let balao = ''

    if (motivoCafe) {
      this.cafeAtual = motivoCafe
      alvo = 'cafe'
      pose = 'tomandoCafe'
      balao = motivoCafe.balao
    } else if (ferramentaAtual) {
      const categoria = categoriaDaFerramenta(ferramentaAtual.ferramenta)
      balao = textoDoBalaoDaFerramenta(ferramentaAtual)
      pose = categoria.pose
      if (categoria.estacao) {
        const tempoDecorrido = instanteAtual - ferramentaAtual.inicio
        if (tempoDecorrido >= ATRASO_PARA_DESLOCAR_MS || this.alvoAtual === categoria.estacao) alvo = categoria.estacao
        else alvo = this.alvoAtual ?? 'mesa'
        if (alvo !== categoria.estacao) pose = this.poseNoAlvo(alvo)
      }
    } else {
      const ultimaConcluida = dados.historico?.[dados.historico.length - 1]
      const recente = ultimaConcluida?.fim && instanteAtual - ultimaConcluida.fim < PERMANENCIA_APOS_FERRAMENTA_MS
      if (recente && this.alvoAtual && this.alvoAtual !== 'mesa') {
        alvo = this.alvoAtual
        pose = this.poseNoAlvo(alvo)
      } else if (dados.pensando) {
        const pensamentoLongo = instanteAtual - this.inicioPensamento > PENSAMENTO_LONGO_MS
        alvo = pensamentoLongo ? 'lousa' : 'mesa'
        pose = pensamentoLongo ? 'escrevendoLousa' : 'pensando'
        balao = '💭 …'
      } else if (dados.estado === 'aguardando') {
        pose = 'aguardandoSentado'
        balao = '❓ Aguardando você'
      }
    }

    if (alvo === 'mesa' && !ferramentaAtual && !dados.pensando && this.escritorio.ocioso) {
      pose = 'cochilando'
      balao = `💤 ${'z'.repeat(1 + (Math.floor(agora / 700) % 3))}`
    }

    if (balao) figura.mostrarBalao(balao)
    else figura.esconderBalao()

    if (alvo !== this.alvoAtual) {
      if (this.alvoAtual === 'cafe') this.sairDoCafe()
      this.alvoAtual = alvo
      this.chegouAoAlvo = false
      const ponto = this.pontoDoAlvo(alvo)
      this.andarAte(() => ponto).then(() => {
        if (this.alvoAtual !== alvo) return
        this.chegouAoAlvo = true
        figura.olharParaDirecao(this.direcaoDoAlvo(alvo))
        if (alvo === 'cafe') this.chegarAoCafe()
      })
    }
    if (this.chegouAoAlvo) {
      const parceiro = alvo === 'cafe' && performance.now() < this.conversaAte ? this.parceiroConversa : null
      if (parceiro) figura.olharPara(parceiro.posicao.x, parceiro.posicao.z)
      else figura.olharParaDirecao(this.direcaoDoAlvo(alvo))
    }
    figura.definirPose(this.chegouAoAlvo ? pose : 'emPe')
  }

  poseNoAlvo(alvo) {
    if (alvo === 'mesa') return 'sentado'
    if (alvo === 'lousa') return 'escrevendoLousa'
    if (alvo === 'cafe') return 'tomandoCafe'
    return 'usando'
  }

  pontoDoAlvo(alvo) {
    if (alvo === 'mesa') return this.escritorio.assentoDoAgente(this.figura.id)
    if (alvo === 'cafe') return this.escritorio.ocuparVagaCafe(this.figura.id)
    return ESTACOES[alvo].ponto
  }

  direcaoDoAlvo(alvo) {
    if (alvo === 'mesa') return Math.PI
    if (alvo === 'cafe') return DIRECAO_CAFETEIRA
    return ESTACOES[alvo].direcao
  }

  sentarImediatamente() {
    const [x, z] = this.escritorio.assentoDoAgente(this.figura.id)
    this.figura.posicionar(x, z)
    this.figura.olharParaDirecao(Math.PI)
    this.alvoAtual = 'mesa'
    this.chegouAoAlvo = true
    this.figura.definirPose('sentado')
  }

  async encontrarPai(paiId) {
    const figura = this.figura
    const pai = () => this.escritorio.figuraDoPai(paiId, figura.id)
    figura.definirPose('emPe')
    await this.andarAte(() => {
      const atual = pai()
      return atual ? [atual.posicao.x, atual.posicao.z] : [figura.posicao.x, figura.posicao.z]
    }, { distanciaParada: DISTANCIA_CONVERSA })
    const figuraPai = pai()
    if (!figuraPai) return null
    figuraPai.travar(DURACAO_CONVERSA_MS)
    figura.travar(DURACAO_CONVERSA_MS)
    figura.olharPara(figuraPai.posicao.x, figuraPai.posicao.z)
    figuraPai.olharPara(figura.posicao.x, figura.posicao.z)
    figura.definirPose('emPe')
    this.escritorio.focarEm([figuraPai, figura], DURACAO_FOCO_ENTREGA_MS)
    return figuraPai
  }

  iniciarChegada(paiId) {
    const figura = this.figura
    const [xFora, zFora] = this.escritorio.pontoForaDaPorta()
    figura.posicionar(xFora, zFora)
    figura.aparecer()
    return this.enfileirarRoteiro(async () => {
      await this.andarAte(() => this.escritorio.pontoDentroDaPorta())
      const figuraPai = await this.encontrarPai(paiId)
      if (figuraPai) {
        const descricao = this.dados.descricao || this.dados.tipoAgente
        figuraPai.mostrarBalao(`📨 ${descricao}`, { duracaoMs: DURACAO_CONVERSA_MS, prioritario: true })
        figuraPai.definirPose('entregando')
        await esperar(900)
        await this.escritorio.animarEntrega(figuraPai, figura, 'tarefa')
        figura.mostrarBalao('👍 Entendido', { duracaoMs: 1200, prioritario: true })
        await esperar(700)
        figuraPai.definirPose('emPe')
      }
      await this.andarAte(() => this.escritorio.assentoDoAgente(figura.id))
      figura.soltarCarga()
      figura.olharParaDirecao(Math.PI)
      this.alvoAtual = 'mesa'
      this.chegouAoAlvo = true
    })
  }

  iniciarRetorno(paiId, sucesso) {
    if (this.saindo) return this.filaRoteiros
    this.saindo = true
    const figura = this.figura
    return this.enfileirarRoteiro(async () => {
      const tipoEntrega = sucesso ? 'resultado' : 'falha'
      figura.carregar(tipoEntrega)
      figura.mostrarBalao(sucesso ? '✅ Concluído' : '⚠️ Não deu certo', { duracaoMs: 1600, prioritario: true })
      figura.definirPose('emPe')
      await esperar(500)
      const figuraPai = await this.encontrarPai(paiId)
      if (figuraPai) {
        if (this.escritorio.controladores.get(figuraPai.id)?.noCafe) {
          figuraPai.travar(DURACAO_CONVERSA_MS + ESPERA_EXTRA_ENTREGA_NO_CAFE_MS)
          figura.mostrarBalao('🙄 te achei no café, chefe', { duracaoMs: ESPERA_EXTRA_ENTREGA_NO_CAFE_MS + 200, prioritario: true })
          await esperar(ESPERA_EXTRA_ENTREGA_NO_CAFE_MS)
        }
        figura.definirPose('entregando')
        await esperar(400)
        await this.escritorio.animarEntrega(figura, figuraPai, tipoEntrega)
        figuraPai.mostrarBalao(sucesso ? '📩 Recebido' : '📩 Recebido (com falha)', { duracaoMs: 1600, prioritario: true })
        figura.definirPose('emPe')
        setTimeout(() => figuraPai.soltarCarga(), 1800)
        await esperar(700)
      }
      await this.andarAte(() => this.escritorio.pontoDentroDaPorta())
      await this.andarAte(() => this.escritorio.pontoForaDaPorta())
      figura.desaparecer()
      await esperar(400)
      this.escritorio.removerFigura(figura.id)
    })
  }
}
