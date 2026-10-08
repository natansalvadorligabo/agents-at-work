import type { EngineInterface, Hook, Register } from 'claude-code'
import { DEFAULT_PORT, EventType, MAIN_AGENT_ID } from '../shared/protocol.js'
import { EventQueue } from './lib/event-queue.js'
import type { OutgoingEvent } from './lib/event-queue.js'
import {
  EVENTS_URL,
  HEALTH_URL,
  SERVER_PORT_ENV,
  browserOpenCommands,
  officePageUrl,
} from './lib/office-config.js'
import { ThinkingRelay } from './lib/thinking-relay.js'
import { folderName, shorten, summarizeToolInput } from './lib/tool-summary.js'

// Every function that touches `$` lives in this file: the engine follows `$` only into functions declared
// in the hooks module itself, never across an import (see `claude plugin validate`). Pure logic is in lib/.

export const OFFICE_COMMAND = 'office'

const SERVER_CHECK_INTERVAL_MS = 5000
const READY_POLL_ATTEMPTS = 20
const READY_POLL_INTERVAL_MS = 150
const LIVE_AGENT_STATUSES = new Set(['running', 'pending', 'waiting'])

const queue = new EventQueue(() => Date.now())
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
    const { exitCode } = await $.process.run(argv)
    return exitCode === 0
  } catch {
    return false
  }
}

async function openInBrowser($: EngineInterface, url: string): Promise<boolean> {
  for (const argv of browserOpenCommands(url)) {
    if (await runsSuccessfully($, argv)) return true
  }
  return false
}

async function openOffice($: EngineInterface): Promise<{ text: string }> {
  await waitForOfficeServer($)
  const url = officePageUrl(sessionId)
  const opened = await openInBrowser($, url)
  return { text: opened ? `Office opened at ${url}` : `Open ${url} in your browser` }
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
    text: `Open ${officePageUrl(sessionId)} in your browser`,
  }))
  on('session.end', onSessionEnd)
  on('turn.start', onTurnStart)
  on('turn.complete', onTurnComplete)
  // Observers only: if publishing throws, the spawn / tool call proceeds untouched.
  on('agent.spawn', onAgentSpawn).catch(($, e, next) => next(e))
  on('tool.call', onToolCall).catch(($, e, next) => next(e))
  on('turn.step', onTurnStep)
}
