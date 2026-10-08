import { expect, test } from 'claude-code/testing'

test('observing a tool call does not change its result', async ($, on) => {
  on('tool.call', () => ({ result: 'file contents' }))
  const result = await $.tool.call({ tool: 'Read', file_path: 'Order.java' })
  expect(result.result).toBe('file contents')
})

test('a failing tool call still reaches the caller unchanged', async ($, on) => {
  on('tool.call', () => ({ result: 'boom', isError: true }))
  const result = await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(result.isError).toBe(true)
})

test('the /office command is registered when the session starts', async ($, on) => {
  const registered: string[] = []
  on('session.start', (_engine, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'test-session' }))
  on('agent.list', () => ({ value: [] }))
  on('command.register', (_engine, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  await $.session.start({ cwd: 'C:/projects/shop', surface: 'terminal', isInteractive: true })
  expect(registered).toContain('office')
  expect(registered).not.toContain('escritorio')
})
