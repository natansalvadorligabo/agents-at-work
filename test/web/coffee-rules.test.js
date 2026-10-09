import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CoffeeReasoner, DELEGATION_THRESHOLD_MS } from '../../web/src/coffee/coffee-rules.js'
import { toolRecord, translatorFor } from '../fakes/builders.js'

// Any moment but 0, which the reasoner reads as "not waiting yet".
const START = 1000

/** @param {Partial<import('../../web/src/coffee/coffee-rules.js').CoffeeSituation>} fields */
function situation(fields) {
  return {
    currentTool: toolRecord({ tool: 'Agent', startedAt: 0 }),
    now: START,
    thinking: false,
    childCount: 3,
    arrivingChildCount: 0,
    atCoffee: false,
    ...fields,
  }
}

describe('CoffeeReasoner while delegating', () => {
  it('supervises from the coffee machine once the subagents are at work', () => {
    const reasoner = new CoffeeReasoner(translatorFor('en'))
    assert.equal(reasoner.reasonFor(situation({ now: START })), null)
    assert.equal(reasoner.reasonFor(situation({ now: START + DELEGATION_THRESHOLD_MS }))?.reason, 'delegated')
  })

  // Regression: the boss ran off for coffee while new hires were still walking in for their envelope.
  it('stays at the desk while subagents are still coming in for their task', () => {
    const reasoner = new CoffeeReasoner(translatorFor('en'))
    for (const now of [START, START + DELEGATION_THRESHOLD_MS, START + DELEGATION_THRESHOLD_MS * 4]) {
      assert.equal(reasoner.reasonFor(situation({ now, arrivingChildCount: 2 })), null)
    }
    const settled = START + DELEGATION_THRESHOLD_MS * 5
    assert.equal(reasoner.reasonFor(situation({ now: settled })), null, 'the wait starts once they are in')
    assert.equal(
      reasoner.reasonFor(situation({ now: settled + DELEGATION_THRESHOLD_MS }))?.reason,
      'delegated',
    )
  })
})
