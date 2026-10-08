// Cafeteira: o lugar do tempo de espera. Quem está no café está bloqueado, não trabalhando.

export const LIMIAR_COMPILANDO_MS = 10000
export const LIMIAR_DELEGACAO_MS = 3000
export const CAFES_PARA_ESTAR_OTIMO = 5
export const DURACAO_TREMEDEIRA_MS = 6000
export const DIRECAO_CAFETEIRA = -Math.PI / 2

// Lugares em pé diante da bancada; quem chega depois que todos estão ocupados fica na roda.
export const VAGAS_CAFE = [
  [1.0, 4.45],
  [1.0, 5.35],
  [1.65, 4.9],
  [1.65, 5.8],
  [2.2, 5.35],
  [2.2, 6.2],
]

const FOFOCAS = [
  ({ alguem }) => [`viu o diff do ${alguem}?`, 'vi… 3 arquivos pra trocar uma vírgula'],
  () => ['dizem que o principal usa --force', 'shhh, ele tá logo ali'],
  () => ['esse prompt veio sem contexto nenhum', 'o meu veio com 4 mil tokens e nenhuma pergunta'],
  ({ cafesOutro }) => ['quantos cafés hoje?', `${cafesOutro}. mas quem tá contando?`],
  () => ['rodou os testes?', 'rodei. passaram. não confio.'],
  () => ['funciona na minha máquina', 'a gente nem tem máquina'],
  ({ alguem }) => [`o ${alguem} tá lendo o README de novo`, 'terceira vez hoje'],
  () => ['sexta-feira… deploy?', 'só se for de café'],
  () => ['acho que o chefe esqueceu da gente', 'melhor. mais café'],
  () => ['tô esperando o npm install desde ontem', 'node_modules pesa mais que o prédio'],
  () => ['quem deixou o TODO de 2019?', 'o git blame diz que foi você'],
  () => ['me pediram pra "só dar uma olhadinha"', 'clássico. quantos arquivos?'],
]

export function sortearFofoca(contexto) {
  return FOFOCAS[Math.floor(Math.random() * FOFOCAS.length)](contexto)
}

export function textoCompilando(registro) {
  const oQue = registro.resumo || registro.ferramenta
  return `☕ ${oQue}… tá compilando`
}

export function textoSupervisionando(quantidade) {
  return `☕ supervisionando ${quantidade} subagente${quantidade === 1 ? '' : 's'}`
}

export function textoEstouOtimo(cafes) {
  return `☕×${cafes} ESTOU ÓTIMO`
}

export function formatarTempoCafe(milissegundos) {
  const segundos = Math.round(milissegundos / 1000)
  if (segundos < 60) return `${segundos}s`
  return `${Math.floor(segundos / 60)}m${String(segundos % 60).padStart(2, '0')}s`
}

export function rotuloCafes(cafes) {
  return `${cafes} café${cafes === 1 ? '' : 's'}`
}
