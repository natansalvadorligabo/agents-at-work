import type { EngineInterface, Register } from 'claude-code'

const PORTA = 47821
const ENDERECO_SERVIDOR = `http://127.0.0.1:${PORTA}`
const AGENTE_PRINCIPAL = 'principal'
const INTERVALO_VERIFICACAO_SERVIDOR_MS = 5000
const INTERVALO_ENVIO_PENSAMENTO_MS = 300
const TAMANHO_MAXIMO_LOTE = 50
const TAMANHO_MAXIMO_RESUMO = 60

type Evento = { tipo: string; agenteId?: string; [campo: string]: unknown }

let sessaoId = ''
let projeto = ''
let servidorEmExecucao = false
let envioEmAndamento = false
const filaEventos: Evento[] = []

function nomeDaPasta(caminho: string): string {
  const partes = caminho.split(/[\\/]/).filter(Boolean)
  return partes[partes.length - 1] ?? caminho
}

function encurtar(texto: string): string {
  const linhaUnica = texto.replace(/\s+/g, ' ').trim()
  return linhaUnica.length > TAMANHO_MAXIMO_RESUMO
    ? `${linhaUnica.slice(0, TAMANHO_MAXIMO_RESUMO - 1)}…`
    : linhaUnica
}

function resumirArgumentos(argumentos: Record<string, unknown>): string {
  const texto = (campo: string) => (typeof argumentos[campo] === 'string' ? (argumentos[campo] as string) : undefined)
  const arquivo = texto('file_path') ?? texto('notebook_path')
  if (arquivo) return nomeDaPasta(arquivo)
  const url = texto('url')
  if (url) {
    try {
      return new URL(url).host
    } catch {
      return encurtar(url)
    }
  }
  const valor = texto('command') ?? texto('pattern') ?? texto('query') ?? texto('description') ?? texto('prompt')
  return valor ? encurtar(valor) : ''
}

function publicar($: EngineInterface, evento: Evento): void {
  filaEventos.push({ ...evento, sessaoId, projeto, instante: Date.now() })
  if (!envioEmAndamento) void descarregarFila($)
}

async function descarregarFila($: EngineInterface): Promise<void> {
  envioEmAndamento = true
  try {
    while (filaEventos.length > 0) {
      const lote = filaEventos.splice(0, TAMANHO_MAXIMO_LOTE)
      try {
        await $.http.fetch(`${ENDERECO_SERVIDOR}/eventos`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(lote),
        })
      } catch {
        // Sem servidor no ar os eventos são descartados: a cena se recompõe pelo snapshot seguinte.
      }
    }
  } finally {
    envioEmAndamento = false
  }
}

async function servidorResponde($: EngineInterface): Promise<boolean> {
  try {
    const resposta = await $.http.fetch(`${ENDERECO_SERVIDOR}/saude`)
    return resposta.ok
  } catch {
    return false
  }
}

async function garantirServidor($: EngineInterface): Promise<void> {
  if (servidorEmExecucao || (await servidorResponde($))) return
  servidorEmExecucao = true
  try {
    const processo = $.process.spawn({
      argv: ['node', `${$.plugin.root}/servidor/servidor.mjs`],
      env: { ESCRITORIO_PORTA: String(PORTA) },
    })
    for await (const saida of processo) $.ui.log(saida.text, { to: 'debug' })
  } catch (erro) {
    $.ui.log(`servidor do escritório não iniciou: ${String(erro)}`, { to: 'debug' })
  } finally {
    servidorEmExecucao = false
  }
}

async function publicarAgentesEmExecucao($: EngineInterface): Promise<void> {
  const agentes = await $.agent.list()
  for (const agente of agentes) {
    if (agente.status !== 'running' && agente.status !== 'pending' && agente.status !== 'waiting') continue
    publicar($, {
      tipo: 'agente.criado',
      agenteId: agente.id,
      paiId: agente.parentId ?? AGENTE_PRINCIPAL,
      tipoAgente: agente.type,
      descricao: agente.description,
      nome: agente.name,
      restaurado: true,
    })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const iniciada = await next(e)
    sessaoId = await $.session.id()
    projeto = nomeDaPasta(e.cwd)
    await $.command.register({
      name: 'escritorio',
      description: 'Abre no navegador o escritório em voxel dos agentes desta sessão',
    })
    void garantirServidor($)
    $.clock.every(INTERVALO_VERIFICACAO_SERVIDOR_MS, () => void garantirServidor($))
    publicar($, { tipo: 'sessao.inicio' })
    void publicarAgentesEmExecucao($)
    return iniciada
  })

  on('command.run', { command: 'escritorio' }, async $ => {
    await garantirServidorAntesDeAbrir($)
    const endereco = `${ENDERECO_SERVIDOR}/?sessao=${encodeURIComponent(sessaoId)}`
    // "start" é um comando interno do cmd; o título vazio evita que a URL seja lida como título da janela.
    await $.process.run(['cmd', '/c', 'start', '', endereco])
    return { text: `Escritório aberto em ${endereco}` }
  })

  on('session.end', async ($, e, next) => {
    publicar($, { tipo: 'sessao.fim', motivo: e.reason })
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    publicar($, { tipo: 'turno.inicio', agenteId: AGENTE_PRINCIPAL })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      publicar($, { tipo: 'turno.fim', agenteId: AGENTE_PRINCIPAL, motivo: e.reason })
    } else {
      publicar($, {
        tipo: 'agente.concluido',
        agenteId: e.agentId,
        motivo: e.reason,
        resposta: encurtar(e.answer),
        duracaoMs: e.durationMs,
      })
    }
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const resultado = await next(e)
    if (resultado.agentId !== undefined) {
      publicar($, {
        tipo: 'agente.criado',
        agenteId: resultado.agentId,
        paiId: e.parentAgentId ?? AGENTE_PRINCIPAL,
        tipoAgente: e.subagentType,
        descricao: e.description,
        nome: e.name,
        prompt: e.prompt,
        segundoPlano: e.background,
      })
    }
    return resultado
  })

  on('tool.call', async ($, e, next) => {
    const agenteId = e.agentId ?? AGENTE_PRINCIPAL
    const ferramentaId = e.tool_use_id ?? `${agenteId}-${Date.now()}`
    publicar($, {
      tipo: 'ferramenta.inicio',
      agenteId,
      ferramentaId,
      ferramenta: String(e.tool),
      resumo: resumirArgumentos(e as unknown as Record<string, unknown>),
    })
    const resultado = await next(e)
    publicar($, {
      tipo: 'ferramenta.fim',
      agenteId,
      ferramentaId,
      erro: resultado.deny !== undefined || resultado.isError === true,
    })
    return resultado
  })

  on('turn.step', async function* ($, e, next) {
    const agenteId = e.agentId ?? AGENTE_PRINCIPAL
    let pensando = false
    let pensamentoPendente = ''
    let ultimoEnvio = 0

    const enviarPensamentoPendente = () => {
      if (pensamentoPendente === '') return
      publicar($, { tipo: 'pensamento', agenteId, texto: pensamentoPendente })
      pensamentoPendente = ''
      ultimoEnvio = Date.now()
    }
    const encerrarPensamento = () => {
      if (!pensando) return
      enviarPensamentoPendente()
      publicar($, { tipo: 'pensamento.fim', agenteId })
      pensando = false
    }

    try {
      for await (const pedaco of next(e)) {
        yield pedaco
        if (pedaco.kind === 'thinking') {
          if (!pensando) {
            pensando = true
            publicar($, { tipo: 'pensamento.inicio', agenteId })
          }
          pensamentoPendente += pedaco.text
          if (Date.now() - ultimoEnvio >= INTERVALO_ENVIO_PENSAMENTO_MS) enviarPensamentoPendente()
        } else if (pedaco.kind !== 'engine') {
          encerrarPensamento()
        }
      }
    } finally {
      encerrarPensamento()
    }
  })
}

async function garantirServidorAntesDeAbrir($: EngineInterface): Promise<void> {
  if (await servidorResponde($)) return
  void garantirServidor($)
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    await $.clock.sleep(150)
    if (await servidorResponde($)) return
  }
}
