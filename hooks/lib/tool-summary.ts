const SUMMARY_MAX_LENGTH = 60

const PATH_FIELDS = ['file_path', 'notebook_path'] as const
const TEXT_FIELDS = ['command', 'pattern', 'query', 'description', 'prompt'] as const

/**
 * Returns the last segment of a Windows or POSIX path.
 * @example folderName('C:/projects/shop') // 'shop'
 */
export function folderName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/**
 * Collapses whitespace and cuts long text with an ellipsis so it fits in a speech bubble.
 * @example shorten('npm   run\nbuild') // 'npm run build'
 */
export function shorten(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= SUMMARY_MAX_LENGTH) return singleLine
  return `${singleLine.slice(0, SUMMARY_MAX_LENGTH - 1)}…`
}

/**
 * Picks the one argument that best tells what a tool call is doing (file, host, command…).
 * @example summarizeToolInput({ tool: 'Read', file_path: 'src/app.ts' }) // 'app.ts'
 */
export function summarizeToolInput(input: Record<string, unknown>): string {
  const path = firstString(input, PATH_FIELDS)
  if (path) return folderName(path)
  const url = firstString(input, ['url'])
  if (url) return hostOf(url)
  const text = firstString(input, TEXT_FIELDS)
  return text ? shorten(text) : ''
}

function firstString(input: Record<string, unknown>, fields: readonly string[]): string | undefined {
  for (const field of fields) {
    const value = input[field]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return shorten(url)
  }
}
