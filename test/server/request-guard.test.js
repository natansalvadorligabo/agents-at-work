import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ControlKeys } from '../../server/control-keys.js'
import {
  isFromOutsideBrowser,
  isLoopbackHost,
  isSameOriginOrNone,
  keysMatch,
} from '../../server/request-guard.js'

describe('request guard', () => {
  it('accepts only loopback host names on our port', () => {
    assert.ok(isLoopbackHost({ host: '127.0.0.1:47821' }, 47821))
    assert.ok(isLoopbackHost({ host: 'localhost:47821' }, 47821))
    assert.ok(!isLoopbackHost({ host: 'rebind.evil.example:47821' }, 47821))
    assert.ok(!isLoopbackHost({}, 47821))
  })

  it('accepts no origin or our own origin only', () => {
    assert.ok(isSameOriginOrNone({ host: '127.0.0.1:1' }))
    assert.ok(isSameOriginOrNone({ host: '127.0.0.1:1', origin: 'http://127.0.0.1:1' }))
    assert.ok(!isSameOriginOrNone({ host: '127.0.0.1:1', origin: 'http://127.0.0.1:2' }))
  })

  it('tells plugin requests from browser requests', () => {
    assert.ok(isFromOutsideBrowser({ host: 'x', 'sec-fetch-mode': 'cors' }))
    assert.ok(!isFromOutsideBrowser({ host: 'x', 'sec-fetch-site': 'same-origin' }))
    assert.ok(!isFromOutsideBrowser({ host: 'x', origin: 'http://x' }))
  })

  it('compares keys strictly', () => {
    assert.ok(keysMatch('abc', 'abc'))
    assert.ok(!keysMatch('abc', 'abd'))
    assert.ok(!keysMatch(undefined, 'abc'))
    assert.ok(!keysMatch('abc', undefined))
  })
})

describe('ControlKeys', () => {
  it('accepts the registered key of a session only', () => {
    const keys = new ControlKeys()
    keys.register('s1', 'a'.repeat(32))
    assert.ok(keys.accepts('s1', 'a'.repeat(32)))
    assert.ok(!keys.accepts('s2', 'a'.repeat(32)))
  })

  it('lets a reloaded plugin replace the key and rejects weak keys', () => {
    const keys = new ControlKeys()
    keys.register('s1', 'a'.repeat(32))
    keys.register('s1', 'b'.repeat(32))
    assert.ok(!keys.accepts('s1', 'a'.repeat(32)))
    assert.throws(() => keys.register('s1', 'short'), { message: /expected a string of 32\+ characters/ })
  })
})
