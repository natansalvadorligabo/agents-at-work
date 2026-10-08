// Fills the office with many subagents to see how it copes with a crowd. Each scenario keeps everyone
// working in a loop until the time runs out (or Ctrl+C).
// Usage: npm run demo:crowd -- <scenario> [minutes] [sessionId]
// Open the printed page before the run starts to watch everyone walk in; opened later, they are already seated.
//   office-12   12 subagents doing a bit of everything
//   coffee-20   19 subagents with long builds: they and the boss (20 in all) end up at the coffee machine
//   station-12  12 subagents reading at the same time: more than 10 at the bookshelf
//   office-50   50 subagents: a long room, small agents
//   office-320  320 subagents: past the 4096 floor tiles the front row of the floor is no longer drawn
import { EventType, MAIN_AGENT_ID } from '#shared/protocol.js'
import { SimulatedSession, sleep } from './simulator.js'

/** @typedef {{ tool: string, summary: string, seconds: number }} Step */

/** @type {Readonly<Record<string, { count: number, steps: (index: number) => Step[] }>>} */
const SCENARIOS = Object.freeze({
  'office-12': { count: 12, steps: mixedWork },
  'coffee-20': {
    count: 19,
    steps: () => [
      { tool: 'Bash', summary: 'npm run build', seconds: 40 },
      { tool: 'Edit', summary: 'vite.config.ts', seconds: 5 },
    ],
  },
  'station-12': {
    count: 12,
    steps: () => [
      { tool: 'Read', summary: 'README.md', seconds: 30 },
      { tool: 'Edit', summary: 'notes.md', seconds: 4 },
    ],
  },
  'office-50': { count: 50, steps: mixedWork },
  'office-320': { count: 320, steps: mixedWork },
})

const MIXED = /** @type {readonly Step[]} */ ([
  { tool: 'Read', summary: 'src/app.ts', seconds: 4 },
  { tool: 'Edit', summary: 'src/app.ts', seconds: 5 },
  { tool: 'Bash', summary: 'npm test', seconds: 6 },
  { tool: 'WebSearch', summary: 'three.js instancing', seconds: 5 },
  { tool: 'mcp__claude_ai_Notion__notion-search', summary: 'roadmap', seconds: 4 },
  { tool: 'TodoWrite', summary: '3 tasks', seconds: 3 },
  { tool: 'Grep', summary: 'TODO', seconds: 3 },
])

/**
 * A different rotation of the mixed tools for each agent, so the office is busy everywhere at once.
 * @param {number} index
 * @returns {Step[]}
 */
function mixedWork(index) {
  return MIXED.map((_, i) => MIXED[(i + index) % MIXED.length]).filter(step => step !== undefined)
}

const name = process.argv[2] ?? ''
const scenario = SCENARIOS[name]
if (!scenario) {
  console.error(`Unknown scenario "${name}"; expected one of: ${Object.keys(SCENARIOS).join(', ')}`)
  process.exit(1)
}
const until = Date.now() + Number(process.argv[3] ?? 15) * 60_000
const session = new SimulatedSession({
  sessionId: process.argv[4] ?? name,
  project: `crowd ${name}`,
  log: () => {},
})

/**
 * @param {string} agentId
 * @param {Step[]} steps
 * @param {number} startAfter Seconds: lets the agent walk in and sit down first.
 */
async function work(agentId, steps, startAfter) {
  await sleep(startAfter)
  for (let i = 0; Date.now() < until; i++) {
    const step = steps[i % steps.length]
    if (step) await session.useTool(agentId, step.tool, step.summary, step.seconds)
    await sleep(1 + (i % 3))
  }
  await session.finish(agentId, 'done')
}

console.log(`${name}: ${scenario.count} subagents → ${session.pageUrl}`)
await session.send({ type: EventType.SESSION_START }, { type: EventType.TURN_START, agentId: MAIN_AGENT_ID })
await session.send({
  type: EventType.TOOL_START,
  agentId: MAIN_AGENT_ID,
  toolUseId: 'delegation',
  tool: 'Agent',
  summary: `${scenario.count} tasks`,
})
/** @type {Promise<void>[]} */
const workers = []
for (let index = 0; index < scenario.count; index++) {
  const agentId = `${name}-${index + 1}`
  await session.send({
    type: EventType.AGENT_SPAWNED,
    agentId,
    parentId: MAIN_AGENT_ID,
    agentType: 'general-purpose',
    description: `Task ${index + 1}`,
    background: true,
  })
  workers.push(work(agentId, scenario.steps(index), 12 + index * 0.4))
  await sleep(0.15)
}
await Promise.all(workers)
await session.send({ type: EventType.TOOL_END, agentId: MAIN_AGENT_ID, toolUseId: 'delegation' })
console.log(`${name}: done`)
