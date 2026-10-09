import { describe, expect, test } from 'claude-code/testing'
import { createControlKey, readPollAnswer, shouldAskOffice, watchersOf } from './permission-policy.js'

describe('shouldAskOffice', () => {
  test('offers only real calls the engine would ask about', async () => {
    expect(shouldAskOffice('ask', 'Bash', 'toolu_1')).toBe(true)
    expect(shouldAskOffice('allow', 'Bash', 'toolu_1')).toBe(false)
    expect(shouldAskOffice('ask', 'Bash', undefined)).toBe(false)
  })

  test('leaves questions and plan approval to the person', async () => {
    expect(shouldAskOffice('ask', 'AskUserQuestion', 'toolu_1')).toBe(false)
    expect(shouldAskOffice('ask', 'ExitPlanMode', 'toolu_1')).toBe(false)
  })

  // Regression: an office allow of SubagentHandback was refused, so no subagent report ever arrived.
  test("leaves a subagent's report hand-back to the engine", async () => {
    expect(shouldAskOffice('ask', 'SubagentHandback', 'toolu_1')).toBe(false)
  })
})

describe('readPollAnswer', () => {
  test('returns final decisions', async () => {
    expect(readPollAnswer('{"decision":"allow","watchers":1}')).toBe('allow')
    expect(readPollAnswer('{"decision":"deny","watchers":0}')).toBe('deny')
  })

  test('keeps waiting only while someone watches', async () => {
    expect(readPollAnswer('{"decision":"pending","watchers":2}')).toBe('wait')
    expect(readPollAnswer('{"decision":"pending","watchers":0}')).toBe('give-up')
    expect(readPollAnswer('{"decision":"expired","watchers":1}')).toBe('give-up')
    expect(readPollAnswer('garbage')).toBe('give-up')
  })
})

describe('watchersOf', () => {
  test('reads the watcher count, zero when unreadable', async () => {
    expect(watchersOf('{"watchers":2}')).toBe(2)
    expect(watchersOf('nope')).toBe(0)
  })
})

describe('createControlKey', () => {
  test('makes 64 hex characters, different each time', async () => {
    const key = createControlKey(crypto)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(createControlKey(crypto)).not.toBe(key)
  })
})
