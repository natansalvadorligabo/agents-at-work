import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Character } from '../../web/src/agents/character.js'
import { SEAT_HEIGHT } from '../../web/src/agents/poses.js'
import { agentSnapshot, translatorFor } from '../fakes/builders.js'
import { FakeClock } from '../fakes/fake-clock.js'
import { FakeLabelLayer } from '../fakes/fake-label-layer.js'

function seatedCharacter() {
  const character = new Character({
    snapshot: agentSnapshot(),
    labels: new FakeLabelLayer(),
    clock: new FakeClock(),
    random: () => 0,
    translator: translatorFor('en'),
  })
  character.seat = [6, 4.3]
  character.setPose('typing')
  return character
}

/** @param {Character} character */
function settle(character) {
  for (let frame = 0; frame < 120; frame++) character.update(1 / 60)
}

describe('sitting only on the seat', () => {
  // Regression: displaced by a hand-off, agents sat down in front of their chair, legs through it.
  it('stands instead of sitting anywhere but on its seat', () => {
    const character = seatedCharacter()
    character.placeAt(6.3, 5.0)
    settle(character)
    assert.equal(character.isOnSeat, false)
    assert.ok(character.rig.body.position.y < SEAT_HEIGHT / 2, 'the body stays at standing height')
    assert.ok(Math.abs(character.rig.leftLeg.rotation.x) < 0.3, 'the legs stay straight')
  })

  it('sits down once it reaches the seat', () => {
    const character = seatedCharacter()
    character.placeAt(6, 4.3)
    settle(character)
    assert.equal(character.isOnSeat, true)
    assert.ok(character.rig.body.position.y > SEAT_HEIGHT * 0.9, 'the body is on the seat')
  })

  it('sits instead of standing idle on its seat, legs clear of the chair', () => {
    const character = seatedCharacter()
    character.placeAt(6, 4.3)
    character.setPose('standing')
    settle(character)
    assert.ok(character.rig.body.position.y > SEAT_HEIGHT * 0.9, 'the body is on the seat')
  })
})
