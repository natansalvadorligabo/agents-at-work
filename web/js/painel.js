import { escaparHtml } from './personagem.js'
import { textoDoBalaoDaFerramenta } from './atividades.js'

const ROTULOS_ESTADO = {
  trabalhando: 'Trabalhando',
  aguardando: 'Aguardando você',
  concluido: 'Concluído',
  falhou: 'Falhou',
}

const LIMITE_HISTORICO_EXIBIDO = 40

function formatarHorario(instante) {
  return instante ? new Date(instante).toLocaleTimeString('pt-BR') : ''
}

function formatarDuracao(registro) {
  if (!registro.fim) return 'em andamento'
  const milissegundos = registro.fim - registro.inicio
  return milissegundos < 1000 ? `${milissegundos} ms` : `${(milissegundos / 1000).toFixed(1)} s`
}

export class PainelDetalhes {
  constructor(elemento, obterDados) {
    this.elemento = elemento
    this.obterDados = obterDados
    this.agenteId = null
    this.redesenhoAgendado = false
    elemento.addEventListener('click', evento => {
      if (evento.target.closest('[data-acao="fechar"]')) this.fechar()
    })
  }

  abrir(agenteId) {
    this.agenteId = agenteId
    this.elemento.classList.add('aberto')
    this.desenhar()
  }

  fechar() {
    this.agenteId = null
    this.elemento.classList.remove('aberto')
  }

  notificarAlteracao(agenteId) {
    if (agenteId !== this.agenteId || this.redesenhoAgendado) return
    this.redesenhoAgendado = true
    requestAnimationFrame(() => {
      this.redesenhoAgendado = false
      this.desenhar()
    })
  }

  desenhar() {
    const dados = this.agenteId ? this.obterDados(this.agenteId) : null
    if (!dados) return
    const blocoPensamentoAnterior = this.elemento.querySelector('.pensamento')
    const estavaNoFim = !blocoPensamentoAnterior || blocoPensamentoAnterior.scrollHeight - blocoPensamentoAnterior.scrollTop - blocoPensamentoAnterior.clientHeight < 24
    const ativas = Object.values(dados.ferramentasAtivas ?? {})
    const historico = (dados.historico ?? []).slice(-LIMITE_HISTORICO_EXIBIDO).reverse()
    const titulo = dados.tipoAgente === 'principal' ? 'Agente principal' : dados.nome || dados.descricao || dados.tipoAgente
    const estado = dados.pensando ? 'Pensando' : ROTULOS_ESTADO[dados.estado] ?? dados.estado

    this.elemento.innerHTML = `
      <header>
        <div>
          <div class="painel-tipo">${escaparHtml(dados.tipoAgente)}</div>
          <h2>${escaparHtml(titulo)}</h2>
        </div>
        <button class="botao" data-acao="fechar" aria-label="Fechar painel">✕</button>
      </header>
      <dl class="painel-fatos">
        <dt>Estado</dt><dd>${escaparHtml(estado)}</dd>
        ${dados.paiId ? `<dt>Criado por</dt><dd>${escaparHtml(dados.paiId === 'principal' ? 'Agente principal' : dados.paiId)}</dd>` : ''}
        ${dados.segundoPlano ? '<dt>Execução</dt><dd>Segundo plano</dd>' : ''}
        <dt>Desde</dt><dd>${escaparHtml(formatarHorario(dados.criadoEm))}</dd>
      </dl>
      ${ativas.length ? `<section><h3>Agora</h3><ul class="lista-ferramentas">${ativas.map(registro => `<li class="ativa">${escaparHtml(textoDoBalaoDaFerramenta(registro))}</li>`).join('')}</ul></section>` : ''}
      ${dados.prompt ? `<section><h3>Tarefa recebida</h3><details><summary>${escaparHtml(dados.descricao || 'Ver prompt')}</summary><pre>${escaparHtml(dados.prompt)}</pre></details></section>` : ''}
      <section>
        <h3>Pensamento ${dados.pensando ? '<span class="indicador-vivo">ao vivo</span>' : ''}</h3>
        <pre class="pensamento">${escaparHtml(dados.pensamento || 'Nenhum pensamento registrado ainda.')}</pre>
      </section>
      <section>
        <h3>Ferramentas (${(dados.historico ?? []).length})</h3>
        <ul class="lista-ferramentas">
          ${historico.map(registro => `<li class="${registro.erro ? 'erro' : ''}"><span>${escaparHtml(textoDoBalaoDaFerramenta(registro))}</span><small>${escaparHtml(formatarDuracao(registro))}</small></li>`).join('') || '<li class="vazio">Nenhuma ferramenta usada.</li>'}
        </ul>
      </section>
      ${dados.resposta ? `<section><h3>Resposta</h3><pre>${escaparHtml(dados.resposta)}</pre></section>` : ''}
    `
    const blocoPensamento = this.elemento.querySelector('.pensamento')
    if (estavaNoFim) blocoPensamento.scrollTop = blocoPensamento.scrollHeight
    else blocoPensamento.scrollTop = blocoPensamentoAnterior.scrollTop
  }
}
