import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORTA = Number(process.env.ESCRITORIO_PORTA ?? 47821)
const RAIZ_WEB = fileURLToPath(new URL('../web/', import.meta.url))
const AGENTE_PRINCIPAL = 'principal'
const LIMITE_PENSAMENTO = 12000
const LIMITE_HISTORICO = 150
const TENTATIVAS_PORTA = 15
const INTERVALO_TENTATIVA_PORTA_MS = 300

const TIPOS_CONTEUDO = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

const sessoes = new Map()
const assinantes = new Set()
let sessaoMaisRecente = null

function criarAgente(id, dados = {}) {
  return {
    id,
    paiId: dados.paiId ?? null,
    tipoAgente: dados.tipoAgente ?? (id === AGENTE_PRINCIPAL ? 'principal' : 'general-purpose'),
    descricao: dados.descricao ?? (id === AGENTE_PRINCIPAL ? 'Agente principal' : ''),
    nome: dados.nome ?? null,
    prompt: dados.prompt ?? '',
    segundoPlano: dados.segundoPlano ?? false,
    estado: id === AGENTE_PRINCIPAL ? 'aguardando' : 'trabalhando',
    ferramentasAtivas: {},
    pensando: false,
    pensamento: '',
    historico: [],
    resposta: '',
    criadoEm: Date.now(),
  }
}

function obterSessao(evento) {
  const id = evento.sessaoId || 'sessao'
  let sessao = sessoes.get(id)
  if (!sessao) {
    sessao = { id, projeto: evento.projeto ?? '', encerrada: false, agentes: new Map() }
    sessao.agentes.set(AGENTE_PRINCIPAL, criarAgente(AGENTE_PRINCIPAL))
    sessoes.set(id, sessao)
  }
  if (evento.projeto) sessao.projeto = evento.projeto
  sessaoMaisRecente = id
  return sessao
}

function obterAgente(sessao, agenteId) {
  let agente = sessao.agentes.get(agenteId)
  if (!agente) {
    agente = criarAgente(agenteId, { paiId: AGENTE_PRINCIPAL })
    sessao.agentes.set(agenteId, agente)
  }
  return agente
}

function aplicarEvento(evento) {
  const sessao = obterSessao(evento)
  const agenteId = evento.agenteId ?? AGENTE_PRINCIPAL

  switch (evento.tipo) {
    case 'sessao.inicio':
      sessao.encerrada = false
      return null
    case 'sessao.fim':
      sessao.encerrada = true
      return null
    case 'agente.criado': {
      const existente = sessao.agentes.get(agenteId)
      const agente = criarAgente(agenteId, { ...existente, ...evento })
      if (existente) {
        agente.historico = existente.historico
        agente.pensamento = existente.pensamento
        agente.criadoEm = existente.criadoEm
        if (!evento.prompt) agente.prompt = existente.prompt
      }
      sessao.agentes.set(agenteId, agente)
      return agente
    }
    case 'agente.concluido': {
      const agente = obterAgente(sessao, agenteId)
      agente.estado = evento.motivo === 'answer' ? 'concluido' : 'falhou'
      agente.resposta = evento.resposta ?? ''
      agente.ferramentasAtivas = {}
      agente.pensando = false
      return agente
    }
    case 'turno.inicio': {
      const agente = obterAgente(sessao, agenteId)
      agente.estado = 'trabalhando'
      return agente
    }
    case 'turno.fim': {
      const agente = obterAgente(sessao, agenteId)
      agente.estado = 'aguardando'
      agente.ferramentasAtivas = {}
      agente.pensando = false
      return agente
    }
    case 'ferramenta.inicio': {
      const agente = obterAgente(sessao, agenteId)
      if (agente.estado !== 'trabalhando') agente.estado = 'trabalhando'
      const registro = { id: evento.ferramentaId, ferramenta: evento.ferramenta, resumo: evento.resumo, inicio: evento.instante, fim: null, erro: false }
      agente.ferramentasAtivas[evento.ferramentaId] = registro
      agente.historico.push(registro)
      if (agente.historico.length > LIMITE_HISTORICO) agente.historico.splice(0, agente.historico.length - LIMITE_HISTORICO)
      return agente
    }
    case 'ferramenta.fim': {
      const agente = obterAgente(sessao, agenteId)
      const registro = agente.ferramentasAtivas[evento.ferramentaId]
      if (registro) {
        registro.fim = evento.instante
        registro.erro = Boolean(evento.erro)
        delete agente.ferramentasAtivas[evento.ferramentaId]
      }
      return agente
    }
    case 'pensamento.inicio': {
      const agente = obterAgente(sessao, agenteId)
      agente.pensando = true
      agente.pensamento += agente.pensamento ? '\n\n' : ''
      return agente
    }
    case 'pensamento': {
      const agente = obterAgente(sessao, agenteId)
      agente.pensamento = (agente.pensamento + (evento.texto ?? '')).slice(-LIMITE_PENSAMENTO)
      return agente
    }
    case 'pensamento.fim': {
      const agente = obterAgente(sessao, agenteId)
      agente.pensando = false
      return agente
    }
    default:
      return null
  }
}

function descreverSessao(sessao) {
  return {
    id: sessao.id,
    projeto: sessao.projeto,
    encerrada: sessao.encerrada,
    agentes: [...sessao.agentes.values()].filter(agente => agente.estado !== 'concluido' && agente.estado !== 'falhou'),
  }
}

function enviarParaAssinante(resposta, nome, dados) {
  resposta.write(`event: ${nome}\ndata: ${JSON.stringify(dados)}\n\n`)
}

function difundir(nome, dados) {
  for (const assinante of assinantes) enviarParaAssinante(assinante, nome, dados)
}

function lerCorpo(requisicao) {
  return new Promise((resolver, rejeitar) => {
    const partes = []
    requisicao.on('data', parte => partes.push(parte))
    requisicao.on('end', () => resolver(Buffer.concat(partes).toString('utf8')))
    requisicao.on('error', rejeitar)
  })
}

async function receberEventos(requisicao, resposta) {
  const corpo = await lerCorpo(requisicao)
  const recebidos = JSON.parse(corpo)
  for (const evento of Array.isArray(recebidos) ? recebidos : [recebidos]) {
    const agente = aplicarEvento(evento)
    const sessao = sessoes.get(evento.sessaoId || 'sessao')
    difundir('evento', { evento, agente, sessao: { id: sessao.id, projeto: sessao.projeto, encerrada: sessao.encerrada } })
  }
  resposta.writeHead(204).end()
}

function assinarFluxo(requisicao, resposta, url) {
  resposta.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  const sessaoPedida = url.searchParams.get('sessao')
  const sessao = sessoes.get(sessaoPedida) ?? sessoes.get(sessaoMaisRecente)
  enviarParaAssinante(resposta, 'estado', sessao ? descreverSessao(sessao) : null)
  assinantes.add(resposta)
  const manterConexao = setInterval(() => resposta.write(': ativo\n\n'), 15000)
  requisicao.on('close', () => {
    clearInterval(manterConexao)
    assinantes.delete(resposta)
  })
}

async function servirArquivo(resposta, url) {
  const caminhoRelativo = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1))
  const caminho = normalize(join(RAIZ_WEB, caminhoRelativo))
  if (!caminho.startsWith(normalize(RAIZ_WEB).replace(new RegExp(`\\${sep}?$`), sep))) {
    resposta.writeHead(403).end()
    return
  }
  try {
    const conteudo = await readFile(caminho)
    resposta.writeHead(200, {
      'content-type': TIPOS_CONTEUDO[extname(caminho)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    resposta.end(conteudo)
  } catch {
    resposta.writeHead(404).end()
  }
}

const servidor = createServer(async (requisicao, resposta) => {
  const url = new URL(requisicao.url, `http://${requisicao.headers.host ?? '127.0.0.1'}`)
  try {
    if (requisicao.method === 'POST' && url.pathname === '/eventos') return await receberEventos(requisicao, resposta)
    if (url.pathname === '/saude') return resposta.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
    if (url.pathname === '/fluxo') return assinarFluxo(requisicao, resposta, url)
    if (requisicao.method === 'GET') return await servirArquivo(resposta, url)
    resposta.writeHead(405).end()
  } catch (erro) {
    console.error(erro)
    if (!resposta.headersSent) resposta.writeHead(400).end()
  }
})

let tentativasRestantes = TENTATIVAS_PORTA
servidor.on('error', erro => {
  // Num hot reload o processo antigo ainda segura a porta por alguns instantes.
  if (erro.code === 'EADDRINUSE' && --tentativasRestantes > 0) {
    setTimeout(() => servidor.listen(PORTA, '127.0.0.1'), INTERVALO_TENTATIVA_PORTA_MS)
    return
  }
  console.error(`escritório: não foi possível ouvir a porta ${PORTA}: ${erro.message}`)
  process.exit(erro.code === 'EADDRINUSE' ? 0 : 1)
})
servidor.listen(PORTA, '127.0.0.1', () => console.log(`escritório ouvindo em http://127.0.0.1:${PORTA}`))
