export const ESTACOES = {
  estante: { ponto: [1.0, 1.35], direcao: Math.PI },
  lousa: { ponto: [4.0, 1.3], direcao: Math.PI },
  rack: { ponto: [6.5, 1.45], direcao: Math.PI },
  globo: { ponto: [8.5, 1.5], direcao: Math.PI },
  telefone: { ponto: [10.5, 1.4], direcao: Math.PI },
}

const CATEGORIAS = [
  { teste: /^(Read|Grep|Glob|LS|NotebookRead|Skill|ToolSearch)$/, estacao: 'estante', pose: 'usando', icone: '📚' },
  { teste: /^(Edit|Write|MultiEdit|NotebookEdit)$/, estacao: null, pose: 'digitando', icone: '⌨️' },
  { teste: /^(Bash|PowerShell|BashOutput|KillShell|Monitor|TaskStop)$/, estacao: 'rack', pose: 'usando', icone: '🖥️' },
  { teste: /^(WebSearch|WebFetch)$/, estacao: 'globo', pose: 'usando', icone: '🌐' },
  { teste: /^mcp__/, estacao: 'telefone', pose: 'usando', icone: '📞' },
  { teste: /^(Agent|Task|SendMessage|Workflow)$/, estacao: null, pose: 'aguardandoSentado', icone: '📨' },
  { teste: /^(TodoWrite|TaskCreate|TaskUpdate|EnterPlanMode|ExitPlanMode)$/, estacao: 'lousa', pose: 'escrevendoLousa', icone: '📝' },
  { teste: /^AskUserQuestion$/, estacao: null, pose: 'aguardandoSentado', icone: '❓' },
]

const CATEGORIA_PADRAO = { estacao: null, pose: 'digitando', icone: '🔧' }

export function categoriaDaFerramenta(ferramenta) {
  return CATEGORIAS.find(categoria => categoria.teste.test(ferramenta)) ?? CATEGORIA_PADRAO
}

export function nomeExibidoDaFerramenta(ferramenta) {
  const partesMcp = /^mcp__(.+?)__(.+)$/.exec(ferramenta)
  if (ferramenta === 'Agent' || ferramenta === 'Task') return 'Delegou:'
  if (!partesMcp) return ferramenta
  const servidor = partesMcp[1].replace(/^claude_ai_/, '').replace(/_/g, ' ')
  return `${servidor}: ${partesMcp[2]}`
}

export function textoDoBalaoDaFerramenta(registro) {
  const categoria = categoriaDaFerramenta(registro.ferramenta)
  const resumo = registro.resumo ? ` ${registro.resumo}` : ''
  return `${categoria.icone} ${nomeExibidoDaFerramenta(registro.ferramenta)}${resumo}`
}
