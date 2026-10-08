// Short scene: two subagents run long commands side by side and gossip at the coffee machine.
// Usage: npm run demo:gossip -- [sessionId]
import { EventType, MAIN_AGENT_ID } from '#shared/protocol.js'
import { SimulatedSession, sleep } from './simulator.js'

const session = new SimulatedSession({
  sessionId: process.argv[2] ?? 'coffee-demo',
  project: 'agents-at-work',
})

console.log(`Session ${session.sessionId} → ${session.pageUrl}`)
await session.send({ type: EventType.TURN_START, agentId: MAIN_AGENT_ID })
await session.delegate('sub-lint', 'Run the linter')
await session.delegate('sub-e2e', 'End-to-end tests')
await session.send({ type: EventType.TURN_END, agentId: MAIN_AGENT_ID, reason: 'answer' })
await sleep(6)
await Promise.all([
  session.useTool('sub-lint', 'Bash', 'npm run lint', 40),
  session.useTool('sub-e2e', 'Bash', 'npx playwright test', 40),
])
await session.finish('sub-lint', 'lint ok')
await sleep(4)
await session.finish('sub-e2e', 'e2e ok')
