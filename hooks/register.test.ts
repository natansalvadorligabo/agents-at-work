import { expect, test } from 'claude-code/testing'

test('observar uma ferramenta não altera o resultado dela', async ($, on) => {
  on('tool.call', () => ({ result: 'conteúdo lido' }))
  const resultado = await $.tool.call({ tool: 'Read', file_path: 'Pedido.java' })
  expect(resultado.result).toBe('conteúdo lido')
})

test('o comando /escritorio é registrado no início da sessão', async ($, on) => {
  const comandosRegistrados: string[] = []
  on('session.start', (_engine, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'sessao-teste' }))
  on('agent.list', () => ({ value: [] }))
  on('command.register', (_engine, e) => {
    comandosRegistrados.push(e.name)
    return { value: { command: e.name } }
  })
  await $.session.start({ cwd: 'C:/projetos/gix-financeiro', surface: 'terminal', isInteractive: true })
  expect(comandosRegistrados).toContain('escritorio')
})
