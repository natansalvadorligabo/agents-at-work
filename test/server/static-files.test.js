import assert from 'node:assert/strict'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { StaticFiles, resolveInside } from '../../server/static-files.js'
import { FakeFileReader } from '../fakes/fake-file-reader.js'

const WEB = join('/app', 'web')
const SHARED = join('/app', 'shared')

function createFiles() {
  const reader = new FakeFileReader({
    [join(WEB, 'index.html')]: '<html>',
    [join(WEB, 'src', 'main.js')]: 'start()',
    [join(SHARED, 'protocol.js')]: 'export {}',
  })
  const mounts = [
    { urlPrefix: '/shared/', directory: SHARED },
    { urlPrefix: '/', directory: WEB },
  ]
  return { files: new StaticFiles({ mounts, reader }), reader }
}

describe('resolveInside', () => {
  it('joins paths inside the directory and refuses escapes', () => {
    assert.equal(resolveInside(WEB, 'src/main.js'), join(WEB, 'src', 'main.js'))
    assert.equal(resolveInside(WEB, '../package.json'), null)
  })
})

describe('StaticFiles', () => {
  it('serves index.html for the root with its content type', async () => {
    const result = await createFiles().files.resolve('/')
    assert.equal(result.status, 200)
    assert.equal(result.status === 200 && result.contentType, 'text/html; charset=utf-8')
  })

  it('serves the shared protocol from its own mount', async () => {
    const result = await createFiles().files.resolve('/shared/protocol.js')
    assert.equal(result.status === 200 && new TextDecoder().decode(result.body), 'export {}')
  })

  it('answers 404 for missing files and 403 for traversal', async () => {
    const { files } = createFiles()
    assert.equal((await files.resolve('/missing.js')).status, 404)
    assert.equal((await files.resolve('/..%2f..%2fetc%2fpasswd')).status, 403)
  })
})
