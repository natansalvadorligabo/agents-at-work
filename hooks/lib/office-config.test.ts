import { describe, expect, test } from 'claude-code/testing'
import { browserOpenCommands, officePageUrl } from './office-config.js'

describe('officePageUrl', () => {
  test('encodes the session id into the query string', async () => {
    expect(officePageUrl('abc 1')).toBe('http://127.0.0.1:47821/?session=abc%201')
  })
})

describe('browserOpenCommands', () => {
  test('tries Windows first, then macOS, then Linux', async () => {
    const commands = browserOpenCommands('http://x')
    expect(commands.map(command => command[0])).toEqual(['cmd', 'open', 'xdg-open'])
    expect(commands[0]).toEqual(['cmd', '/c', 'start', '', 'http://x'])
  })
})
