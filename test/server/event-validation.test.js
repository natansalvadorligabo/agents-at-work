import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EventValidationError, parseEventBatch, validateEvent } from '../../server/event-validation.js'

const now = () => 42

describe('parseEventBatch', () => {
  it('accepts a single event or an array', () => {
    assert.equal(parseEventBatch('{"type":"turn.start","sessionId":"s"}', now).length, 1)
    assert.equal(
      parseEventBatch('[{"type":"turn.start","sessionId":"s"},{"type":"turn.end","sessionId":"s"}]', now)
        .length,
      2,
    )
  })

  it('rejects a body that is not JSON, quoting it', () => {
    assert.throws(() => parseEventBatch('not json', now), {
      name: 'EventValidationError',
      message: /"not json".*expected an event/,
    })
  })
})

describe('validateEvent', () => {
  it('fills project and timestamp when missing', () => {
    const event = validateEvent({ type: 'session.start', sessionId: 's1' }, now)
    assert.equal(event.project, '')
    assert.equal(event.timestamp, 42)
  })

  it('keeps the timestamp sent by the hooks', () => {
    assert.equal(validateEvent({ type: 'session.start', sessionId: 's1', timestamp: 7 }, now).timestamp, 7)
  })

  it('names the unknown type and the expected shape', () => {
    assert.throws(() => validateEvent({ type: 'sessao.inicio', sessionId: 's' }, now), {
      message: /Unknown event type "sessao.inicio"; expected \{ type: session.start/,
    })
  })

  it('rejects non-objects and missing session ids', () => {
    assert.throws(() => validateEvent([1], now), EventValidationError)
    assert.throws(() => validateEvent({ type: 'turn.start', sessionId: '' }, now), {
      message: /Invalid sessionId ""/,
    })
  })
})
