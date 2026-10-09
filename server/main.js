import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PORT } from '#shared/protocol.js'
import { CommandDesk } from './command-desk.js'
import { ControlKeys } from './control-keys.js'
import { createRequestListener } from './http-app.js'
import { PermissionDesk, systemTimeouts } from './permission-desk.js'
import { SessionStore } from './session-store.js'
import { StaticFiles } from './static-files.js'
import { StreamHub } from './stream-hub.js'
import { systemIntervalTimer } from '#shared/interval-timer.js'

const HOST = '127.0.0.1'
const PORT_RETRY_ATTEMPTS = 15
const PORT_RETRY_DELAY_MS = 300

const port = Number(process.env.AGENTS_AT_WORK_PORT ?? DEFAULT_PORT)
const staticFiles = new StaticFiles({
  mounts: [
    { urlPrefix: '/shared/', directory: fileURLToPath(new URL('../shared/', import.meta.url)) },
    { urlPrefix: '/', directory: fileURLToPath(new URL('../web/', import.meta.url)) },
  ],
  reader: { readFile },
})
const listener = createRequestListener({
  store: new SessionStore({ now: Date.now }),
  hub: new StreamHub({ timer: systemIntervalTimer }),
  desk: new PermissionDesk({ timeouts: systemTimeouts }),
  keys: new ControlKeys(),
  commands: new CommandDesk({ timeouts: systemTimeouts }),
  newId: randomUUID,
  staticFiles,
  port,
  now: Date.now,
  logError: message => console.error(message),
})
const server = createServer((request, response) => void listener(request, response))

let attemptsLeft = PORT_RETRY_ATTEMPTS
server.on(
  'error',
  /** @param {NodeJS.ErrnoException} error */ error => {
    // On a hot reload the previous process still holds the port for a moment.
    if (error.code === 'EADDRINUSE' && --attemptsLeft > 0) {
      setTimeout(() => server.listen(port, HOST), PORT_RETRY_DELAY_MS)
      return
    }
    console.error(`agents-at-work: cannot listen on port ${port}: ${error.message}`)
    // A busy port almost always means another office server is already up, which is fine.
    process.exit(error.code === 'EADDRINUSE' ? 0 : 1)
  },
)
server.listen(port, HOST, () => console.log(`agents-at-work listening on http://${HOST}:${port}`))
