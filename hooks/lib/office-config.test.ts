import { describe, expect, test } from 'claude-code/testing'
import {
  browserOpenCommands,
  commandResultUrl,
  commandsUrl,
  officePageUrl,
  permissionUrl,
} from './office-config.js'

describe('officePageUrl', () => {
  test('carries the session id and the control key', async () => {
    expect(officePageUrl('abc 1', 'k1')).toBe('http://127.0.0.1:47821/?session=abc%201&key=k1')
  })
})

describe('permissionUrl', () => {
  test('adds the wait only for long-polls', async () => {
    expect(permissionUrl('toolu_1', 25000)).toBe('http://127.0.0.1:47821/permissions/toolu_1?waitMs=25000')
    expect(permissionUrl('toolu_1')).toBe('http://127.0.0.1:47821/permissions/toolu_1')
  })
})

describe('commandsUrl', () => {
  test('long-polls the session commands', async () => {
    expect(commandsUrl('s 1', 25000)).toBe('http://127.0.0.1:47821/commands?session=s%201&waitMs=25000')
    expect(commandResultUrl('c/1')).toBe('http://127.0.0.1:47821/commands/c%2F1/result')
  })
})

describe('browserOpenCommands', () => {
  test('tries Windows first, then macOS, then Linux', async () => {
    const commands = browserOpenCommands('http://x/?a=1&b=2')
    expect(commands.map(command => command[0])).toEqual(['rundll32', 'open', 'xdg-open'])
  })

  // Regression: `cmd /c start` cut the /office link at `&key=`, so the browser never opened.
  test('passes the URL untouched, ampersands included', async () => {
    expect(browserOpenCommands('http://x/?a=1&b=2')[0]).toEqual([
      'rundll32',
      'url.dll,FileProtocolHandler',
      'http://x/?a=1&b=2',
    ])
  })
})
