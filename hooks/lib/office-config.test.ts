import { describe, expect, test } from 'claude-code/testing'
import { browserOpenCommands, officePageUrl, permissionUrl } from './office-config.js'

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

describe('browserOpenCommands', () => {
  test('tries Windows first, then macOS, then Linux', async () => {
    const commands = browserOpenCommands('http://x')
    expect(commands.map(command => command[0])).toEqual(['cmd', 'open', 'xdg-open'])
    expect(commands[0]).toEqual(['cmd', '/c', 'start', '', 'http://x'])
  })
})
