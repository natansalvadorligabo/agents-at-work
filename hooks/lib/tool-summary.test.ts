import { describe, expect, test } from 'claude-code/testing'
import { folderName, shorten, summarizeToolInput } from './tool-summary.js'

describe('folderName', () => {
  test('takes the last segment of Windows and POSIX paths', async () => {
    expect(folderName('C:\\projects\\shop')).toBe('shop')
    expect(folderName('/home/dev/shop/')).toBe('shop')
  })
})

describe('shorten', () => {
  test('collapses whitespace', async () => {
    expect(shorten('npm   run\n build')).toBe('npm run build')
  })

  test('cuts long text to 60 characters with an ellipsis', async () => {
    const result = shorten('x'.repeat(80))
    expect(result.length).toBe(60)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('summarizeToolInput', () => {
  test('prefers the file name', async () => {
    expect(summarizeToolInput({ file_path: 'src/app/Order.java', command: 'ignored' })).toBe('Order.java')
  })

  test('shows only the host of a URL', async () => {
    expect(summarizeToolInput({ url: 'https://example.com/a/b?c=d' })).toBe('example.com')
  })

  test('falls back to the command, pattern or prompt', async () => {
    expect(summarizeToolInput({ command: 'npm test' })).toBe('npm test')
    expect(summarizeToolInput({ pattern: 'TODO' })).toBe('TODO')
  })

  test('is empty when nothing is recognizable', async () => {
    expect(summarizeToolInput({ other: 1 })).toBe('')
  })
})
