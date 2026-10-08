import { AGENTE_PRINCIPAL, Escritorio } from './escritorio.js'
import { PainelDetalhes } from './painel.js'

const parametros = new URLSearchParams(location.search)
let sessaoExibida = parametros.get('sessao')
const dadosPorAgente = new Map()

const ociosidadeEmSegundos = Number(parametros.get('ociosidade'))
const escritorio = new Escritorio(document.getElementById('cena'), document.getElementById('camada-html'), {
  ociosidadeMs: ociosidadeEmSegundos > 0 ? ociosidadeEmSegundos * 1000 : undefined,
})
const painel = new PainelDetalhes(document.getElementById('painel'), agenteId => dadosPorAgente.get(agenteId), {
  estatistica: agenteId => {
    const estatistica = escritorio.estatisticaCafe(agenteId)
    return { ...estatistica, msNoCafe: escritorio.tempoNoCafe(estatistica) }
  },
  ranking: () => escritorio.rankingCafe(),
})
const elementoProjeto = document.getElementById('projeto')
const elementoConexao = document.getElementById('conexao')
const elementoAvisoEncerrada = document.getElementById('aviso-encerrada')
const botaoRecentralizar = document.getElementById('recentralizar')

escritorio.aoSelecionar = agenteId => (agenteId ? painel.abrir(agenteId) : painel.fechar())
escritorio.aoClicarCafeteira = () => painel.abrirRanking()
escritorio.camera.aoMudarModoManual = manual => botaoRecentralizar.classList.toggle('oculto', !manual)
botaoRecentralizar.addEventListener('click', () => escritorio.camera.recentralizar())

function exibirSessao(sessao) {
  if (!sessao) return
  elementoProjeto.textContent = sessao.projeto || 'sessão'
  elementoAvisoEncerrada.classList.toggle('oculto', !sessao.encerrada)
  escritorio.definirSessaoEncerrada(sessao.encerrada)
}

function guardarDados(dados) {
  if (!dados) return
  dadosPorAgente.set(dados.id, dados)
  painel.notificarAlteracao(dados.id)
}

function aplicarEstadoCompleto(sessao) {
  escritorio.limparTudo()
  escritorio.criarAgentePrincipal()
  dadosPorAgente.clear()
  if (!sessao) return
  sessaoExibida = sessaoExibida ?? sessao.id
  exibirSessao(sessao)
  for (const dados of sessao.agentes) {
    guardarDados(dados)
    if (dados.id === AGENTE_PRINCIPAL) escritorio.receberDadosDoAgente(dados)
    else escritorio.adicionarFigura(dados, { restaurado: true })
  }
}

function aplicarEvento({ evento, agente, sessao }) {
  sessaoExibida = sessaoExibida ?? evento.sessaoId
  if (evento.sessaoId !== sessaoExibida) return
  exibirSessao(sessao)
  guardarDados(agente)

  switch (evento.tipo) {
    case 'agente.criado':
      if (escritorio.figuras.has(agente.id)) escritorio.receberDadosDoAgente(agente)
      else escritorio.adicionarFigura(agente, { restaurado: Boolean(evento.restaurado) })
      return
    case 'agente.concluido':
      escritorio.concluirAgente(agente)
      return
    default: {
      if (!agente) return
      const figura = escritorio.receberDadosDoAgente(agente)
      if (!figura && agente.id !== AGENTE_PRINCIPAL && agente.estado === 'trabalhando') escritorio.adicionarFigura(agente)
    }
  }
}

function conectar() {
  const fluxo = new EventSource(`/fluxo${sessaoExibida ? `?sessao=${encodeURIComponent(sessaoExibida)}` : ''}`)
  fluxo.addEventListener('open', () => elementoConexao.classList.add('conectado'))
  fluxo.addEventListener('error', () => elementoConexao.classList.remove('conectado'))
  fluxo.addEventListener('estado', mensagem => aplicarEstadoCompleto(JSON.parse(mensagem.data)))
  fluxo.addEventListener('evento', mensagem => aplicarEvento(JSON.parse(mensagem.data)))
}

conectar()
