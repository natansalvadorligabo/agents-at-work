import { normalize } from 'node:path'

/** A FileReader over an in-memory map of paths to contents. */
export class FakeFileReader {
  /** @type {string[]} */
  reads = []

  /** @param {Record<string, string>} files */
  constructor(files) {
    this.files = new Map(Object.entries(files).map(([path, content]) => [normalize(path), content]))
  }

  /** @param {string} path */
  async readFile(path) {
    this.reads.push(path)
    const content = this.files.get(normalize(path))
    if (content === undefined) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
    return new TextEncoder().encode(content)
  }
}
