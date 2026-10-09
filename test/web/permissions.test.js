import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planActivity } from '../../web/src/agents/activity-planner.js'
import { SEATED_POSES } from '../../web/src/agents/poses.js'
import { ControlClient } from '../../web/src/app/control-client.js'
import { takeControlKey } from '../../web/src/app/control-key.js'
import { renderPermissionRequest } from '../../web/src/ui/permission-view.js'
import { agentSnapshot, translatorFor } from '../fakes/builders.js'
import { FakeStorage } from '../fakes/fake-storage.js'

const REQUEST = {
  id: 'toolu_1',
  tool: 'Bash',
  summary: 'npm install',
  reason: 'Bash needs approval',
  requestedAt: 0,
}

/** Records the requests a ControlClient makes. */
class FakeFetch {
  /** @type {{ url: string, init: { method: string, headers: Record<string, string>, body: string } }[]} */
  calls = []
  status = 204

  /** @param {string} url @param {{ method: string, headers: Record<string, string>, body: string }} init */
  fetch = async (url, init) => {
    this.calls.push({ url, init })
    return { ok: this.status < 300, status: this.status, text: async () => 'refused' }
  }
}

describe('takeControlKey', () => {
  it('moves the key from the address to tab storage', () => {
    const storage = new FakeStorage()
    const { key, cleanUrl } = takeControlKey(new URL('http://127.0.0.1:47821/?session=s1&key=abc'), storage)
    assert.equal(key, 'abc')
    assert.equal(cleanUrl, 'http://127.0.0.1:47821/?session=s1')
    assert.equal(takeControlKey(new URL(cleanUrl), storage).key, 'abc')
  })

  it('has no key without one and survives blocked storage', () => {
    const storage = new FakeStorage()
    storage.broken = true
    assert.equal(takeControlKey(new URL('http://h/?session=s1'), storage).key, null)
    assert.equal(takeControlKey(new URL('http://h/?session=s1&key=k'), storage).key, 'k')
  })
})

describe('ControlClient', () => {
  it('signs decisions with the control key', async () => {
    const fake = new FakeFetch()
    await new ControlClient({ fetch: fake.fetch, key: 'secret' }).decidePermission('toolu_1', 'allow')
    assert.equal(fake.calls[0]?.url, '/permissions/toolu_1/decision')
    assert.equal(fake.calls[0]?.init.headers['x-agents-at-work-key'], 'secret')
    assert.equal(fake.calls[0]?.init.body, '{"decision":"allow"}')
  })

  it('refuses to send without a key and reports server refusals', async () => {
    const fake = new FakeFetch()
    assert.equal(new ControlClient({ fetch: fake.fetch, key: null }).canDecide, false)
    await assert.rejects(
      new ControlClient({ fetch: fake.fetch, key: null }).decidePermission('t', 'deny'),
      /No control key/,
    )
    fake.status = 403
    await assert.rejects(
      new ControlClient({ fetch: fake.fetch, key: 'k' }).decidePermission('t', 'deny'),
      /403: refused/,
    )
  })
})

describe('permission in the office', () => {
  it('makes the agent stay put and raise its hand', () => {
    const snapshot = agentSnapshot({ pendingPermission: REQUEST })
    const input = {
      snapshot,
      now: 0,
      currentTarget: /** @type {const} */ ('rack'),
      thinkingSince: 0,
      coffeeVisit: null,
      officeIdle: true,
      translator: translatorFor('pt-BR'),
    }
    assert.deepEqual(planActivity(input), {
      target: 'rack',
      pose: 'raisingHand',
      bubble: '🙋 Posso? 🖥️ Bash npm install',
    })
  })

  it('raises the hand from the chair when the agent is at its desk', () => {
    const input = {
      snapshot: agentSnapshot({ pendingPermission: REQUEST }),
      now: 0,
      currentTarget: /** @type {const} */ ('desk'),
      thinkingSince: 0,
      coffeeVisit: null,
      officeIdle: false,
      translator: translatorFor('en'),
    }
    const plan = planActivity(input)
    assert.equal(plan.pose, 'raisingHandSeated')
    assert.ok(SEATED_POSES.has(plan.pose), 'it stays sitting, legs out of the seat')
  })

  it('renders the card with enabled buttons only when the page holds the key', () => {
    const translator = translatorFor('en')
    const enabled = renderPermissionRequest(REQUEST, { canDecide: true, translator })
    assert.match(enabled, /data-action="allow" data-request-id="toolu_1">Allow/)
    assert.match(enabled, /Bash needs approval/)
    assert.match(renderPermissionRequest(REQUEST, { canDecide: false, translator }), /disabled.*\/office/s)
  })
})
