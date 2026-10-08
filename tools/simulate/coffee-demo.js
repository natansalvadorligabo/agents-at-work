// ~2 minute demo of the coffee machine: long builds, a failing test run (spilled coffee), the boss
// supervising from the coffee machine and, in act 2, the boss's fifth coffee ("I FEEL GREAT").
// Usage: npm run demo:coffee -- [sessionId]
import { EventType, MAIN_AGENT_ID } from '#shared/protocol.js'
import { SimulatedSession, sleep } from './simulator.js'

const session = new SimulatedSession({
  sessionId: process.argv[2] ?? 'coffee-demo',
  project: 'agents-at-work',
})

/** @param {SimulatedSession} s */
async function buildAgent(s) {
  await sleep(6)
  await s.useTool('sub-build', 'Read', 'package.json', 2)
  await s.useTool('sub-build', 'Bash', 'npm run build', 20)
  await s.useTool('sub-build', 'Edit', 'vite.config.ts', 3)
  await s.finish('sub-build', 'build ok')
}

/** @param {SimulatedSession} s */
async function testAgent(s) {
  await sleep(7)
  await s.useTool('sub-tests', 'Grep', 'describe\(', 2)
  await s.useTool('sub-tests', 'Bash', 'npm test', 18, true)
  await s.useTool('sub-tests', 'Edit', 'order.test.ts', 4)
  await s.finish('sub-tests', 'fixed 1 test')
}

/** @param {SimulatedSession} s */
async function dependencyAgent(s) {
  await sleep(8)
  await s.useTool('sub-deps', 'Glob', '**/package.json', 2)
  await s.useTool('sub-deps', 'PowerShell', 'npm install', 24)
  await s.finish('sub-deps', 'dependencies updated')
}

/** @param {SimulatedSession} s */
async function actOne(s) {
  console.log('\n--- Act 1: the boss delegates 3 subagents and heads for coffee; long commands join him ---')
  await s.delegate('sub-build', 'Run the build')
  await s.delegate('sub-tests', 'Fix the tests')
  await s.delegate('sub-deps', 'Update dependencies')
  await s.send({ type: EventType.TURN_END, agentId: MAIN_AGENT_ID, reason: 'answer' })
  await Promise.all([buildAgent(s), testAgent(s), dependencyAgent(s)])
}

/** @param {SimulatedSession} s @param {number} round */
async function quickRound(s, round) {
  await s.send({ type: EventType.TURN_START, agentId: MAIN_AGENT_ID })
  await s.useTool(MAIN_AGENT_ID, 'Read', `report-${round}.md`, 2)
  await s.delegate(`sub-quick-${round}`, `Quick task ${round}`, 'Explore')
  await s.send({ type: EventType.TURN_END, agentId: MAIN_AGENT_ID, reason: 'answer' })
  await sleep(1)
  await s.useTool(`sub-quick-${round}`, 'Read', 'README.md', 6)
  await s.finish(`sub-quick-${round}`, 'done')
  await sleep(9)
}

console.log(`Session ${session.sessionId} → ${session.pageUrl}`)
await session.send({ type: EventType.SESSION_START }, { type: EventType.TURN_START, agentId: MAIN_AGENT_ID })
await sleep(3)
await actOne(session)
await sleep(10)
console.log('\n--- Act 2: quick delegations until the fifth coffee ---')
for (let round = 1; round <= 4; round++) await quickRound(session, round)
console.log('\nDone. Click the coffee machine to see the ranking.')
