import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ControlClient } from '../../web/src/app/control-client.js'
import { SessionSync } from '../../web/src/app/session-sync.js'
import { renderAgentControls } from '../../web/src/ui/agent-control-view.js'
import { agentSnapshot, translatorFor } from '../fakes/builders.js'

/** @param {Partial<import('../../web/src/ui/agent-control-view.js').AgentControlInput>} [fields] */
function controls(fields = {}) {
  return renderAgentControls({
    snapshot: agentSnapshot(),
    translator: translatorFor('en'),
    canControl: true,
    draftOf: () => '',
    note: null,
    busy: false,
    spawnOpen: false,
    ...fields,
  })
}

describe('renderAgentControls', () => {
  it('lets the main agent take a prompt and hire subagents', () => {
    const html = controls({ snapshot: agentSnapshot({ id: 'main', parentId: null, status: 'waiting' }) })
    assert.match(html, /Talk to the agent/)
    assert.match(html, /data-action="spawn"/)
    assert.doesNotMatch(html, /data-action="stop"/)
  })

  it('offers Stop only while the agent runs a turn', () => {
    assert.match(controls({ snapshot: agentSnapshot({ status: 'working' }) }), /data-action="stop"/)
    assert.doesNotMatch(controls({ snapshot: agentSnapshot({ status: 'done' }) }), /data-action="stop"/)
  })

  it('offers to resume a finished subagent with a message, without hiring', () => {
    const html = controls({ snapshot: agentSnapshot({ status: 'done' }) })
    assert.match(html, /Resume with a message/)
    assert.doesNotMatch(html, /data-action="spawn"/)
  })

  it('keeps the draft, escaped, and disables the buttons while a command is in flight', () => {
    const html = controls({
      draftOf: () => '<b>hi</b>',
      busy: true,
      snapshot: agentSnapshot({ status: 'working' }),
    })
    assert.match(html, />&#60;b&#62;hi&#60;\/b&#62;<\/textarea>/)
    assert.match(html, /data-action="send" disabled/)
    assert.match(html, /data-action="stop" disabled/)
  })

  it('shows a refusal as a failure note', () => {
    assert.match(controls({ note: { text: 'nope', failed: true } }), /control-note failed">nope/)
  })

  it('only points to /office without the control key', () => {
    const html = controls({ canControl: false })
    assert.match(html, /\/office/)
    assert.doesNotMatch(html, /textarea/)
  })
})

describe('ControlClient.sendCommand', () => {
  /** @param {number} status @param {string} text */
  function fakeFetch(status, text) {
    /** @type {{ url: string, init: { method: string, headers: Record<string, string>, body: string } }[]} */
    const calls = []
    /** @type {import('../../web/src/app/control-client.js').FetchFunction} */
    const fetch = async (url, init) => {
      calls.push({ url, init })
      return { ok: status < 300, status, text: async () => text }
    }
    return { calls, fetch }
  }

  it('posts the command for the session on display, signed with the key', async () => {
    const fake = fakeFetch(200, '{"ok":true}')
    const client = new ControlClient({ fetch: fake.fetch, key: 'secret', sessionId: () => 's1' })
    await client.sendCommand({ kind: 'prompt', agentId: 'main', text: 'run the tests' })
    assert.equal(fake.calls[0]?.url, '/commands')
    assert.equal(fake.calls[0]?.init.headers['x-agents-at-work-key'], 'secret')
    assert.deepEqual(JSON.parse(fake.calls[0]?.init.body ?? ''), {
      sessionId: 's1',
      kind: 'prompt',
      agentId: 'main',
      text: 'run the tests',
    })
  })

  it("rejects with the session's own reason", async () => {
    const fake = fakeFetch(422, '{"ok":false,"error":"No running turn for agent a1"}')
    const client = new ControlClient({ fetch: fake.fetch, key: 'k', sessionId: () => 's1' })
    await assert.rejects(client.sendCommand({ kind: 'stop', agentId: 'a1' }), /No running turn for agent a1/)
  })

  it('sends nothing without a key or a session', async () => {
    const fake = fakeFetch(200, '')
    await assert.rejects(
      new ControlClient({ fetch: fake.fetch, key: null }).sendCommand({ kind: 'stop', agentId: 'a' }),
    )
    await assert.rejects(
      new ControlClient({ fetch: fake.fetch, key: 'k' }).sendCommand({ kind: 'stop', agentId: 'a' }),
    )
    assert.equal(fake.calls.length, 0)
  })
})

describe('SessionSync and a session that has not run yet', () => {
  // Regression: a fresh session had no main agent snapshot, so its panel opened empty, with no prompt box.
  it('still has the main agent, idle and ready for a first prompt', () => {
    const office = {
      clearAll() {},
      addMainAgent() {},
      addAgent() {},
      updateAgent() {
        return undefined
      },
      finishAgent() {},
      hasAgent: () => false,
      setSessionEnded() {},
    }
    const sync = new SessionSync({
      office,
      showSession() {},
      onAgentChanged() {},
      onPermissionRequested() {},
      sessionId: 's1',
      now: () => 5,
    })
    sync.applySnapshot(null)
    assert.equal(sync.snapshotOf('main')?.status, 'waiting')
    assert.equal(sync.snapshotOf('main')?.createdAt, 5)
    assert.equal(sync.snapshotOf('sub-1'), undefined)
    const html = controls({ snapshot: /** @type {any} */ (sync.snapshotOf('main')) })
    assert.match(html, /<textarea data-draft="text"/)
  })
})
