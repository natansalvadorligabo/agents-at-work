import { extname, join, normalize, sep } from 'node:path'

/**
 * @typedef {object} FileReader
 * @property {(path: string) => Promise<Uint8Array>} readFile
 *
 * @typedef {object} Mount Maps a URL prefix (ending in "/") to a directory on disk.
 * @property {string} urlPrefix
 * @property {string} directory
 *
 * @typedef {{ status: 200, contentType: string, body: Uint8Array } | { status: 403 | 404 }} StaticFileResult
 */

const CONTENT_TYPES = /** @type {Record<string, string>} */ ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
})

const INDEX_FILE = 'index.html'

/**
 * Joins a URL-derived relative path onto a directory, refusing anything that escapes it.
 * @param {string} directory
 * @param {string} relativePath
 * @returns {string | null}
 * @example resolveInside('/web', '../secret') // null
 */
export function resolveInside(directory, relativePath) {
  const root = normalize(directory).replace(/[\\/]?$/, sep)
  const candidate = normalize(join(root, relativePath))
  return candidate.startsWith(root) ? candidate : null
}

/**
 * Serves files from a few mounted directories (the web app and the shared protocol).
 * @example
 * const files = new StaticFiles({ mounts: [{ urlPrefix: '/', directory: webRoot }], reader: fsPromises })
 * await files.resolve('/index.html')
 */
export class StaticFiles {
  #mounts
  #reader

  /** @param {{ mounts: Mount[], reader: FileReader }} dependencies Longest prefixes should come first. */
  constructor({ mounts, reader }) {
    this.#mounts = mounts
    this.#reader = reader
  }

  /**
   * @param {string} pathname URL path, still percent-encoded.
   * @returns {Promise<StaticFileResult>}
   */
  async resolve(pathname) {
    const mount = this.#mounts.find(candidate => pathname.startsWith(candidate.urlPrefix))
    if (!mount) return { status: 404 }
    const relativePath = decodeURIComponent(pathname.slice(mount.urlPrefix.length)) || INDEX_FILE
    const path = resolveInside(mount.directory, relativePath)
    if (!path) return { status: 403 }
    return this.#read(path)
  }

  /**
   * @param {string} path
   * @returns {Promise<StaticFileResult>}
   */
  async #read(path) {
    try {
      const body = await this.#reader.readFile(path)
      return { status: 200, contentType: CONTENT_TYPES[extname(path)] ?? 'application/octet-stream', body }
    } catch {
      return { status: 404 }
    }
  }
}
