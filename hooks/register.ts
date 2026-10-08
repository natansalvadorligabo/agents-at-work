import type { EngineInterface, Hook, Register } from 'claude-code'
import { DEFAULT_PORT, EventType, MAIN_AGENT_ID } from '../shared/protocol.js'
import { EventQueue } from './lib/event-queue.js'
import type { OutgoingEvent } from './lib/event-queue.js'
import {
  CONTROL_REGISTER_URL,
  EVENTS_URL,
  HEALTH_URL,
  PERMISSIONS_URL,
  SERVER_PORT_ENV,
  browserOpenCommands,
  officePageUrl,
  permissionUrl,
} from './lib/office-config.js'
import {
  POLL_WAIT_MS,
  WEB_APPROVAL_WINDOW_MS,
  createControlKey,
  readPollAnswer,
  shouldAskOffice,
  watchersOf,
} from './lib/permission-policy.js'
import type { FinalDecision } from './lib/permission-policy.js'
import { ThinkingRelay } from './lib/thinking-relay.js'
import { folderName, shorten, summarizeToolInput } from './lib/tool-summary.js'

// Every function that touches `$` lives in this file: the engine follows `$` only into functions declared
// in the hooks module itself, never across an import (see `claude plugin validate`). Pure logic is in lib/.

export const OFFICE_COMMAND = 'office'

const SERVER_CHECK_INTERVAL_MS = 5000
const READY_POLL_ATTEMPTS = 20
const READY_POLL_INTERVAL_MS = 150
const LIVE_AGENT_STATUSES = new Set(['running', 'pending', 'waiting'])

const JSON_HEADERS = { 'content-type': 'application/json' }
const WAITING_FOR_OFFICE = `Waiting for approval in the office (web)… the terminal asks in ${WEB_APPROVAL_WINDOW_MS / 1000} s`

const queue = new EventQueue(() => Date.now())
// The office page must present this key to act on the session; it travels only in the /office link.
const controlKey = createControlKey(crypto)
let sessionId = ''
let launchingServer = false

function publish($: EngineInterface, event: OutgoingEvent): void {
  queue.enqueue(event)
  if (queue.beginFlush()) void flushQueue($)
}

function publishAll($: EngineInterface, events: OutgoingEvent[]): void {
  for (const event of events) publish($, event)
}

async function flushQueue($: EngineInterface): Promise<void> {
  try {
    for (let batch = queue.takeBatch(); batch; batch = queue.takeBatch()) await postEventsQuietly($, batch)
  } finally {
    queue.endFlush()
  }
}

// Re-announces subagents that were already running when the plugin (re)loaded, so the office is not empty.
async function publishRunningAgents($: EngineInterface): Promise<void> {
  for (const agent of await $.agent.list()) {
    if (!LIVE_AGENT_STATUSES.has(agent.status)) continue
    publish($, {
      type: EventType.AGENT_SPAWNED,
      agentId: agent.id,
      parentId: agent.parentId ?? MAIN_AGENT_ID,
      agentType: agent.type,
      description: agent.description,
      name: agent.name ?? null,
      restored: true,
    })
  }
}

// With no server up the events are dropped: the browser rebuilds the scene from the next snapshot.
async function postEventsQuietly($: EngineInterface, batch: OutgoingEvent[]): Promise<void> {
  try {
    const body = JSON.stringify(batch)
    await $.http.fetch(EVENTS_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  } catch {
    // Dropped on purpose, see above.
  }
}

async function isOfficeServerHealthy($: EngineInterface): Promise<boolean> {
  try {
    const response = await $.http.fetch(HEALTH_URL)
    return response.ok
  } catch {
    return false
  }
}

// Spawns the Node server that serves the office page unless one already answers; resolves when it exits.
async function ensureOfficeServer($: EngineInterface): Promise<void> {
  if (launchingServer || (await isOfficeServerHealthy($))) return
  launchingServer = true
  try {
    const argv = ['node', `${$.plugin.root}/server/main.js`]
    const child = $.process.spawn({ argv, env: { [SERVER_PORT_ENV]: String(DEFAULT_PORT) } })
    for await (const output of child) $.ui.log(output.text, { to: 'debug' })
  } catch (error) {
    $.ui.log(`agents-at-work server did not start: ${String(error)}`, { to: 'debug' })
  } finally {
    launchingServer = false
  }
}

// Waits briefly for a fresh server so the browser opens on a live page rather than an error.
async function waitForOfficeServer($: EngineInterface): Promise<void> {
  if (await isOfficeServerHealthy($)) return
  void ensureOfficeServer($)
  for (let attempt = 0; attempt < READY_POLL_ATTEMPTS; attempt++) {
    await $.clock.sleep(READY_POLL_INTERVAL_MS)
    if (await isOfficeServerHealthy($)) return
  }
}

async function runsSuccessfully($: EngineInterface, argv: string[]): Promise<boolean> {
  try {
    const { exitCode, stderr } = await $.process.run(argv)
    if (exitCode !== 0) $.ui.log(`agents-at-work: ${argv[0]} exited ${exitCode}: ${stderr}`, { to: 'debug' })
    return exitCode === 0
  } catch (error) {
    $.ui.log(`agents-at-work: ${argv[0]} did not run: ${String(error)}`, { to: 'debug' })
    return false
  }
}

async function openInBrowser($: EngineInterface, url: string): Promise<boolean> {
  for (const argv of browserOpenCommands(url)) {
    if (await runsSuccessfully($, argv)) return true
  }
  return false
}

// Re-sent before every use: the server keeps keys in memory and may have restarted since.
async function registerControlKey($: EngineInterface): Promise<void> {
  try {
    const body = JSON.stringify({ sessionId, key: controlKey })
    await $.http.fetch(CONTROL_REGISTER_URL, { method: 'POST', headers: JSON_HEADERS, body })
  } catch {
    // No server: nobody can answer on the web anyway.
  }
}

async function openOffice($: EngineInterface): Promise<{ text: string }> {
  await waitForOfficeServer($)
  await registerControlKey($)
  const url = officePageUrl(sessionId, controlKey)
  const opened = await openInBrowser($, url)
  return { text: opened ? `Office opened at ${url}` : `Open ${url} in your browser` }
}

type PermissionQuestion = {
  requestId: string
  agentId: string
  tool: string
  summary: string
  reason: string
}

// Raises the agent's hand on the office page; answers how many pages are open to see it.
async function openPermission($: EngineInterface, question: PermissionQuestion): Promise<number> {
  try {
    const body = JSON.stringify({ sessionId, ...question })
    const response = await $.http.fetch(PERMISSIONS_URL, { method: 'POST', headers: JSON_HEADERS, body })
    return response.ok ? watchersOf(response.text) : 0
  } catch {
    return 0
  }
}

async function pollPermission(
  $: EngineInterface,
  requestId: string,
): Promise<FinalDecision | 'wait' | 'give-up'> {
  try {
    const response = await $.http.fetch(permissionUrl(requestId, POLL_WAIT_MS))
    return response.ok ? readPollAnswer(response.text) : 'give-up'
  } catch {
    return 'give-up'
  }
}

async function withdrawPermission($: EngineInterface, requestId: string): Promise<void> {
  try {
    await $.http.fetch(permissionUrl(requestId), { method: 'DELETE' })
  } catch {
    // The server is gone, and the request with it.
  }
}

// Long-polls instead of sleeping: the hook's 10 s budget pauses during `$.http.fetch`, not `$.clock.sleep`.
async function waitForOfficeDecision($: EngineInterface, requestId: string): Promise<FinalDecision | null> {
  const deadline = Date.now() + WEB_APPROVAL_WINDOW_MS
  while (Date.now() < deadline) {
    const answer = await pollPermission($, requestId)
    if (answer === 'give-up') return null
    if (answer !== 'wait') return answer
  }
  return null
}

// Null means nobody answered on the web: the engine's own dialog then asks in the terminal.
async function askOffice($: EngineInterface, question: PermissionQuestion): Promise<FinalDecision | null> {
  await registerControlKey($)
  if ((await openPermission($, question)) === 0) {
    await withdrawPermission($, question.requestId)
    return null
  }
  $.ui.status(WAITING_FOR_OFFICE)
  try {
    return await waitForOfficeDecision($, question.requestId)
  } finally {
    $.ui.status(undefined)
    await withdrawPermission($, question.requestId)
  }
}

const onToolCheck: Hook<'tool.check'> = async ($, e, next) => {
  const verdict = await next(e)
  if (!shouldAskOffice(verdict.decision, e.tool, e.tool_use_id)) return verdict
  const question = {
    requestId: e.tool_use_id ?? '',
    agentId: e.agentId ?? MAIN_AGENT_ID,
    tool: e.tool,
    summary: summarizeToolInput((e.input ?? {}) as Record<string, unknown>),
    reason: verdict.reason ?? '',
  }
  const decision = await askOffice($, question)
  if (decision === null) return verdict
  const reason = decision === 'allow' ? 'Allowed in the office (web)' : 'Denied in the office (web)'
  return { ...verdict, decision, reason }
}

const onSessionStart: Hook<'session.start'> = async ($, e, next) => {
  const started = await next(e)
  sessionId = await $.session.id()
  queue.identify(sessionId, folderName(e.cwd))
  await $.command.register({
    name: OFFICE_COMMAND,
    description: "Opens this session's voxel office in the browser",
  })
  void ensureOfficeServer($)
  $.clock.every(SERVER_CHECK_INTERVAL_MS, () => void ensureOfficeServer($))
  publish($, { type: EventType.SESSION_START })
  void publishRunningAgents($)
  return started
}

const onSessionEnd: Hook<'session.end'> = async ($, e, next) => {
  publish($, { type: EventType.SESSION_END, reason: e.reason })
  return next(e)
}

const onTurnStart: Hook<'turn.start'> = async ($, e, next) => {
  publish($, { type: EventType.TURN_START, agentId: MAIN_AGENT_ID })
  return next(e)
}

const onTurnComplete: Hook<'turn.complete'> = async ($, e, next) => {
  if (e.agentId === undefined) {
    publish($, { type: EventType.TURN_END, agentId: MAIN_AGENT_ID, reason: e.reason })
  } else {
    const answer = shorten(e.answer)
    publish($, {
      type: EventType.AGENT_FINISHED,
      agentId: e.agentId,
      reason: e.reason,
      answer,
      durationMs: e.durationMs,
    })
  }
  return next(e)
}

const onAgentSpawn: Hook<'agent.spawn'> = async ($, e, next) => {
  const result = await next(e)
  if (result.agentId === undefined) return result
  publish($, {
    type: EventType.AGENT_SPAWNED,
    agentId: result.agentId,
    parentId: e.parentAgentId ?? MAIN_AGENT_ID,
    agentType: e.subagentType,
    description: e.description,
    name: e.name ?? null,
    prompt: e.prompt,
    background: e.background,
  })
  return result
}

const onToolCall: Hook<'tool.call'> = async ($, e, next) => {
  const agentId = e.agentId ?? MAIN_AGENT_ID
  const toolUseId = e.tool_use_id ?? `${agentId}-${Date.now()}`
  const summary = summarizeToolInput(e as unknown as Record<string, unknown>)
  publish($, { type: EventType.TOOL_START, agentId, toolUseId, tool: String(e.tool), summary })
  const result = await next(e)
  const failed = result.deny !== undefined || result.isError === true
  publish($, { type: EventType.TOOL_END, agentId, toolUseId, failed })
  return result
}

const onTurnStep: Hook<'turn.step'> = async function* ($, e, next) {
  const relay = new ThinkingRelay(e.agentId ?? MAIN_AGENT_ID, () => Date.now())
  try {
    for await (const chunk of next(e)) {
      yield chunk
      publishAll(
        $,
        relay.onChunk(chunk.kind, 'text' in chunk && typeof chunk.text === 'string' ? chunk.text : ''),
      )
    }
  } finally {
    publishAll($, relay.finish())
  }
}

/**
 * Plugin entry point: mirrors the session's agents, tools and thinking to the office server.
 * @example { "modules": ["./register.ts"] } // hooks/hooks.json
 */
export const register: Register = on => {
  on('session.start', onSessionStart)
  on('command.run', { command: OFFICE_COMMAND }, async $ => openOffice($)).catch(() => ({
    text: `Open ${officePageUrl(sessionId, controlKey)} in your browser`,
  }))
  on('session.end', onSessionEnd)
  on('turn.start', onTurnStart)
  on('turn.complete', onTurnComplete)
  // Observers only: if publishing throws, the spawn / tool call proceeds untouched.
  on('agent.spawn', onAgentSpawn).catch(($, e, next) => next(e))
  on('tool.call', onToolCall).catch(($, e, next) => next(e))
  // On failure, fall back to the engine's own verdict (its dialog), never to an allow.
  on('tool.check', onToolCheck).catch(($, e, next) => next(e))
  on('turn.step', onTurnStep)
}
