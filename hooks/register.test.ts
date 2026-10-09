import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

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

const reply = (status: number, text = '') => ({ value: { status, ok: status < 400, headers: {}, text } })

// An office server that hands over `commands` once, then holds every later poll until `close`, and
// records what the plugin posts. Ending the session and closing the office stops the plugin polling.
function officeWithCommands(on: Parameters<TestBody>[1], commands: unknown[]) {
  const posted: { url: string; body: string }[] = []
  let polls = 0
  let answered!: (outcome: unknown) => void
  const outcome = new Promise(resolve => (answered = resolve))
  let close!: () => void
  const closed = new Promise<void>(resolve => (close = resolve))
  on('session.start', (_engine, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 's1' }))
  on('agent.list', () => ({ value: [] }))
  on('command.register', (_engine, e) => ({ value: { command: e.name } }))
  on('clock.sleep', () => ({ value: undefined }))
  on('session.end', () => ({ sessionId: 's1' }))
  on('http.fetch', async (_engine, e) => {
    if (e.url.includes('/commands?')) {
      if (polls++ === 0) return reply(200, JSON.stringify({ commands }))
      await closed
      return reply(503)
    }
    const body = String(e.init?.body ?? '')
    posted.push({ url: e.url, body })
    if (e.url.includes('/result')) answered(JSON.parse(body))
    return reply(e.url.endsWith('/health') ? 200 : 204, '{"ok":true}')
  })
  const finish = async ($: Parameters<TestBody>[0]) => {
    await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } })
    close()
  }
  return { posted, outcome, finish }
}

const START = { cwd: 'C:/projects/shop', surface: 'terminal', isInteractive: true } as const

test('a prompt from the office page is submitted as if the person typed it', async ($, on) => {
  const office = officeWithCommands(on, [
    { id: 'c1', kind: 'prompt', agentId: 'main', text: 'run the tests' },
  ])
  const submitted: { text: string; asUser: boolean }[] = []
  on('prompt.submit', (_engine, e) => {
    submitted.push({ text: e.text, asUser: e.origin.kind === 'plugin' && e.origin.asUser === true })
    return { text: e.text }
  })
  await $.session.start(START)
  expect(await office.outcome).toEqual({ ok: true })
  expect(submitted).toEqual([{ text: 'run the tests', asUser: true }])
  await office.finish($)
})

test('a message from the office page reaches the subagent, and a refusal reaches the page', async ($, on) => {
  const office = officeWithCommands(on, [
    { id: 'c1', kind: 'message', agentId: 'a7', text: 'also check docs/' },
  ])
  on('session.send', (_engine, e) => ({ isDelivered: false, reason: `nobody called ${e.to}` }))
  await $.session.start(START)
  expect(await office.outcome).toEqual({ ok: false, error: 'nobody called a7' })
  await office.finish($)
})

test('stopping an agent with no running turn says so instead of aborting', async ($, on) => {
  const office = officeWithCommands(on, [{ id: 'c1', kind: 'stop', agentId: 'main' }])
  await $.session.start(START)
  expect(await office.outcome).toEqual({ ok: false, error: 'No running turn for agent main' })
  await office.finish($)
})

test('a subagent hire the engine refuses is reported to the office page', async ($, on) => {
  const office = officeWithCommands(on, [
    {
      id: 'c1',
      kind: 'spawn',
      agentId: 'main',
      text: 'Read README.md',
      description: 'Read the README',
      subagentType: 'Explore',
    },
  ])
  on('agent.spawn', () => ({ deny: 'no hiring today' }))
  await $.session.start(START)
  expect(await office.outcome).toEqual({ ok: false, error: 'no hiring today' })
  await office.finish($)
})
