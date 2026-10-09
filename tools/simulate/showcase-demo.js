// Everything the office can do, at once, for the README recording: new hires walking in for their
// envelope, every station busy, long builds turning into coffee and gossip, a raised hand waiting for
// permission, a desk punch after two failures in a row, and results delivered back to the boss.
// Usage: npm run demo:showcase -- [minutes] [sessionId]   (AGENTS_AT_WORK_PORT picks another server)
// Open the printed page right away: the first hires walk in within a few seconds.
import { DEFAULT_PORT, EventType, MAIN_AGENT_ID, Route } from '#shared/protocol.js'
import { SimulatedSession, sleep } from './simulator.js'

/** @typedef {{ tool: string, summary: string, seconds: number, failed?: boolean }} Step */

const until = Date.now() + Number(process.argv[2] ?? 3) * 60_000
const baseUrl = `http://127.0.0.1:${process.env.AGENTS_AT_WORK_PORT ?? DEFAULT_PORT}`
const session = new SimulatedSession({
  sessionId: process.argv[3] ?? 'showcase',
  project: 'agents-at-work',
  baseUrl,
  log: () => {},
})

/**
 * Each hire's description and the tools it keeps using, one station each so the whole room moves.
 * @type {readonly { id: string, description: string, type: string, steps: Step[] }[]}
 */
const HIRES = [
  {
    id: 'reader',
    description: 'Map the codebase',
    type: 'Explore',
    steps: [
      { tool: 'Read', summary: 'src/office.ts', seconds: 7 },
      { tool: 'Grep', summary: 'class .*Agent', seconds: 4 },
    ],
  },
  {
    id: 'builder',
    description: 'Ship the build',
    type: 'general-purpose',
    steps: [
      { tool: 'Bash', summary: 'npm run build', seconds: 26 },
      { tool: 'Edit', summary: 'vite.config.ts', seconds: 4 },
    ],
  },
  {
    id: 'installer',
    description: 'Update dependencies',
    type: 'general-purpose',
    steps: [
      { tool: 'PowerShell', summary: 'npm install', seconds: 24 },
      { tool: 'Read', summary: 'package.json', seconds: 4 },
    ],
  },
  {
    id: 'researcher',
    description: 'Research WebGPU',
    type: 'general-purpose',
    steps: [
      { tool: 'WebSearch', summary: 'three.js WebGPU renderer', seconds: 8 },
      { tool: 'WebFetch', summary: 'threejs.org', seconds: 5 },
    ],
  },
  {
    id: 'planner',
    description: 'Plan the release',
    type: 'Plan',
    steps: [
      { tool: 'TodoWrite', summary: '5 tasks', seconds: 7 },
      { tool: 'Read', summary: 'CHANGELOG.md', seconds: 4 },
    ],
  },
  {
    id: 'caller',
    description: 'Sync the roadmap',
    type: 'general-purpose',
    steps: [
      { tool: 'mcp__claude_ai_Notion__notion-search', summary: 'roadmap', seconds: 7 },
      { tool: 'Edit', summary: 'ROADMAP.md', seconds: 5 },
    ],
  },
  {
    id: 'tester',
    description: 'Fix the flaky tests',
    type: 'general-purpose',
    steps: [
      { tool: 'Edit', summary: 'order.test.ts', seconds: 4 },
      { tool: 'Bash', summary: 'npm test', seconds: 3, failed: true },
      { tool: 'Bash', summary: 'npm test', seconds: 3, failed: true },
      { tool: 'Edit', summary: 'order.ts', seconds: 8 },
    ],
  },
]

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function call(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} answered ${response.status}`)
}

/**
 * Raises the agent's hand for a while, as a tool call waiting for approval, then lowers it.
 * @param {string} agentId
 * @param {string} summary
 * @param {number} seconds
 */
async function askPermission(agentId, summary, seconds) {
  const requestId = `toolu_showcase_${agentId}_${Date.now()}`
  const body = { sessionId: session.sessionId, agentId, requestId, tool: 'Bash', summary, reason: '' }
  const headers = { 'content-type': 'application/json' }
  await call(Route.PERMISSIONS, { method: 'POST', headers, body: JSON.stringify(body) })
  await sleep(seconds)
  await call(`${Route.PERMISSIONS}/${requestId}`, { method: 'DELETE' })
}

/**
 * Streams a little thinking, so the main agent's panel and bubble have something live.
 * @param {string} agentId
 * @param {number} seconds
 */
async function think(agentId, seconds) {
  await session.send({ type: EventType.THINKING_START, agentId })
  for (const text of ['Seven tasks, ', 'one desk each. ', 'The tests first…']) {
    await session.send({ type: EventType.THINKING_DELTA, agentId, text })
    await sleep(seconds / 3)
  }
  await session.send({ type: EventType.THINKING_END, agentId })
}

/**
 * @param {string} agentId
 * @param {Step[]} steps
 * @param {number} startAfter Seconds: time to walk in, get the envelope and sit down.
 */
async function work(agentId, steps, startAfter) {
  await sleep(startAfter)
  for (let i = 0; Date.now() < until; i++) {
    const step = /** @type {Step} */ (steps[i % steps.length])
    await session.useTool(agentId, step.tool, step.summary, step.seconds, step.failed)
    await sleep(1 + (i % 2))
  }
}

/** One hire who hands its result back mid-show, then a fresh one walks in for the same kind of task. */
async function quickTurnover() {
  for (let round = 1; Date.now() < until; round++) {
    const agentId = `reviewer-${round}`
    await sleep(round === 1 ? 20 : 6)
    await session.delegate(agentId, 'Review the diff', 'Explore')
    await sleep(14)
    await session.useTool(agentId, 'Read', 'git diff', 6)
    await session.finish(agentId, 'LGTM, two nits', true)
    await sleep(12)
  }
}

/** The boss keeps an eye on everyone: a quick read now and then, and a raised hand for a risky command. */
async function boss() {
  await sleep(30)
  for (let round = 0; Date.now() < until; round++) {
    await askPermission(round % 2 === 0 ? MAIN_AGENT_ID : 'reader', 'git push --force', 9)
    await sleep(12)
    await session.useTool(MAIN_AGENT_ID, 'Read', 'report.md', 4)
    await sleep(10)
  }
}

console.log(`Showcase → ${session.pageUrl}`)
await session.send({ type: EventType.SESSION_START }, { type: EventType.TURN_START, agentId: MAIN_AGENT_ID })
await think(MAIN_AGENT_ID, 3)
/** @type {Promise<void>[]} */
const crew = []
for (const [index, hire] of HIRES.entries()) {
  await session.delegate(hire.id, hire.description, hire.type)
  crew.push(work(hire.id, hire.steps, 14 + index))
  await sleep(0.6)
}
await Promise.all([...crew, quickTurnover(), boss()])
for (const hire of HIRES) await session.finish(hire.id, 'done')
await session.send({ type: EventType.TURN_END, agentId: MAIN_AGENT_ID, reason: 'answer' })
console.log('Showcase: done')
