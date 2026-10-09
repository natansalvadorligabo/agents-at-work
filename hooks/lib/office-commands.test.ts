import { describe, expect, test } from 'claude-code/testing'
import { RunningTurns, failure, readCommands } from './office-commands.js'

describe('readCommands', () => {
  test('keeps well-formed commands and skips the rest', async () => {
    const text = JSON.stringify({
      commands: [
        { id: 'c1', kind: 'prompt', agentId: 'main', text: 'hi' },
        { id: 'c2', kind: 'stop', agentId: 'a1' },
        { id: 'c3', kind: 'message', agentId: 'a1' },
        { id: 'c4', kind: 'dance', agentId: 'a1', text: 'x' },
        { id: 'c5', kind: 'spawn', agentId: 'main', text: 'x' },
      ],
    })
    expect(readCommands(text).map(command => command.id)).toEqual(['c1', 'c2'])
  })

  test('reads nothing from a broken answer', async () => {
    expect(readCommands('<html>')).toEqual([])
    expect(readCommands('null')).toEqual([])
  })
})

describe('RunningTurns', () => {
  test('tracks the turn each agent runs until it completes', async () => {
    const turns = new RunningTurns()
    turns.started(undefined, 't1')
    turns.started('a1', 't2')
    expect(turns.of('main')).toBe('t1')
    turns.ended('a1', 't2')
    expect(turns.of('a1')).toBe(undefined)
  })

  test('ignores the end of a turn that is no longer the running one', async () => {
    const turns = new RunningTurns()
    turns.started(undefined, 't1')
    turns.started(undefined, 't2')
    turns.ended(undefined, 't1')
    expect(turns.of('main')).toBe('t2')
  })
})

describe('failure', () => {
  test('words errors and plain reasons alike', async () => {
    expect(failure(new Error('boom'))).toEqual({ ok: false, error: 'boom' })
    expect(failure('denied')).toEqual({ ok: false, error: 'denied' })
  })
})
