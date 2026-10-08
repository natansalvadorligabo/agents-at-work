// Plays the plugin's side of a web permission request: registers a control key, raises the main agent's
// hand and waits (long-polling, like the hooks module) for Allow / Deny on the page.
// Usage: npm run demo:permission -- [sessionId]
import { randomBytes } from 'node:crypto'
import { DEFAULT_PORT, EventType, MAIN_AGENT_ID, Route } from '#shared/protocol.js'
import { SimulatedSession } from './simulator.js'

const BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`
const session = new SimulatedSession({
  sessionId: process.argv[2] ?? 'permission-demo',
  project: 'agents-at-work',
})
const key = randomBytes(32).toString('hex')
const requestId = `toolu_demo_${Date.now()}`

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function call(path, init) {
  const response = await fetch(`${BASE_URL}${path}`, init)
  const text = await response.text()
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} answered ${response.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

/** @param {unknown} body */
const post = body => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

await session.send({ type: EventType.SESSION_START }, { type: EventType.TURN_START, agentId: MAIN_AGENT_ID })
await call(Route.CONTROL_REGISTER, post({ sessionId: session.sessionId, key }))
console.log(`Open: ${BASE_URL}/?session=${session.sessionId}&key=${key}`)
console.log('Raising the hand in 8 s…')
await new Promise(resolve => setTimeout(resolve, 8000))
const opened = await call(
  Route.PERMISSIONS,
  post({
    sessionId: session.sessionId,
    agentId: MAIN_AGENT_ID,
    requestId,
    tool: 'Bash',
    summary: 'npm install left-pad',
    reason: 'Bash commands need approval',
  }),
)
console.log(`Pages watching: ${opened.watchers}`)
for (let attempt = 0; attempt < 6; attempt++) {
  const answer = await call(`${Route.PERMISSIONS}/${requestId}?waitMs=20000`)
  console.log(`Answer: ${answer.decision}`)
  if (answer.decision !== 'pending') break
}
await call(`${Route.PERMISSIONS}/${requestId}`, { method: 'DELETE' })
