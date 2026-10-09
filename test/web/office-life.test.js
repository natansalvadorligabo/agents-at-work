import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CoffeeSpots } from '../../web/src/coffee/coffee-spots.js'
import { PERSONAL_SPACE, separateCrowd } from '../../web/src/world/crowd.js'
import {
  MAIN_DESK,
  ROOM_DEPTH,
  blockedTiles,
  deskSlotTile,
  requiredRoomWidth,
  seatAt,
  seatSide,
} from '../../web/src/world/layout.js'
import { canStandAt, markOccupied, planRoute } from '../../web/src/world/navigation.js'
import { PathGrid } from '../../web/src/world/path-grid.js'
import { PUNCH_STREAK_MS, Temper } from '../../web/src/agents/temper.js'
import { agentSnapshot, toolRecord } from '../fakes/builders.js'
import { StationSpots } from '../../web/src/world/station-spots.js'

/** @typedef {import('../../web/src/world/crowd.js').CrowdMember} CrowdMember */

/**
 * @param {number} x
 * @param {number} z
 * @param {Partial<CrowdMember>} [fields]
 * @returns {CrowdMember}
 */
function member(x, z, fields = {}) {
  return { position: { x, z }, fixed: false, heading: null, ...fields }
}

/**
 * @param {CrowdMember[]} members
 * @param {number} frames
 * @param {(x: number, z: number) => boolean} [canStand]
 */
function simulate(members, frames, canStand = () => true) {
  for (let i = 0; i < frames; i++) separateCrowd(members, 1 / 60, canStand)
}

/** @param {CrowdMember} a @param {CrowdMember} b */
function gap(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)
}

/** @param {number} [subagents] Each one has a desk; the room grows to fit them. */
function officeGrid(subagents = 2) {
  const slots = Array.from({ length: subagents }, (_, slot) => slot)
  const grid = new PathGrid(requiredRoomWidth(slots), ROOM_DEPTH)
  for (const [x, z] of blockedTiles(slots)) grid.block(x, z)
  return grid
}

describe('separateCrowd', () => {
  it('pulls apart two agents spawned on the same spot', () => {
    const [a, b] = [member(3, 3), member(3, 3)]
    simulate([a, b], 60)
    assert.ok(gap(a, b) >= PERSONAL_SPACE - 0.01)
  })

  it('never moves a seated agent; the standing one makes room', () => {
    const seated = member(2, 4.3, { fixed: true })
    const standing = member(2.1, 4.4)
    simulate([seated, standing], 60)
    assert.deepEqual(seated.position, { x: 2, z: 4.3 })
    assert.ok(gap(seated, standing) >= PERSONAL_SPACE - 0.01)
  })

  it('steers a walker sideways around someone sitting in its way', () => {
    const seated = member(5, 5, { fixed: true })
    const walker = member(4.2, 5, { heading: { x: 7, z: 5 } })
    simulate([seated, walker], 20)
    assert.ok(Math.abs(walker.position.z - 5) > 0.05, 'walker left the straight line')
  })

  it('does not push anyone into furniture', () => {
    const grid = officeGrid()
    // Someone frozen in a hand-off pushes the other towards the boss's chair.
    const seated = member(3.6, 4.5, { fixed: true })
    const standing = member(3.15, 4.3)
    simulate([seated, standing], 60, (x, z) => canStandAt(grid, x, z))
    assert.ok(canStandAt(grid, standing.position.x, standing.position.z))
  })
})

describe('route planning around people', () => {
  it('goes around someone standing still when there is room to', () => {
    const grid = officeGrid()
    const someone = { x: 10.5, z: 4.5 }
    const crossesThem = () =>
      planRoute(grid, { x: 8.5, z: 4.5 }, [12.5, 4.5]).some(
        ([x, z]) => Math.hypot(x - someone.x, z - someone.z) < PERSONAL_SPACE,
      )
    assert.ok(crossesThem(), 'the straight route passes through them')
    markOccupied(grid, [someone])
    assert.ok(!crossesThem())
  })

  it('never walks through a chair, and its own agent gets in from beside it', () => {
    const grid = officeGrid()
    const seat = seatAt(deskSlotTile(0))
    const route = planRoute(grid, { x: 3.5, z: 1.5 }, seat)
    const [beforeX = 0, beforeZ = 0] = route.at(-2) ?? []
    assert.deepEqual(route.at(-1), seat)
    assert.deepEqual([beforeX, beforeZ], seatSide(seat, [3.5, 1.5]))
    assert.ok(Math.abs(beforeX - seat[0]) > 0.5, 'it steps in from the side, not through the backrest')
    const inChair = (/** @type {readonly [number, number]} */ [x, z]) =>
      Math.abs(x - seat[0]) < 0.5 && Math.abs(z - (seat[1] + 0.15)) < 0.45
    assert.ok(
      route.slice(0, -1).every(point => !inChair(point)),
      'only the seat itself is in the chair',
    )
  })

  it('uses the side of the chair closer to where the agent comes from', () => {
    const grid = officeGrid()
    const seat = seatAt(deskSlotTile(0))
    const fromLeft = planRoute(grid, { x: 1.5, z: 6.5 }, seat).at(-2) ?? [0, 0]
    const fromRight = planRoute(grid, { x: 11.5, z: 5.5 }, seat).at(-2) ?? [0, 0]
    assert.ok(fromLeft[0] < seat[0], 'from the left it gets in on the left')
    assert.ok(fromRight[0] > seat[0], 'from the right it gets in on the right')
  })

  it('gets out of the chair beside it, not through the backrest or across the desk', () => {
    const grid = officeGrid()
    const seat = seatAt(MAIN_DESK)
    const route = planRoute(grid, { x: seat[0], z: seat[1] }, [6.5, 1.45])
    assert.deepEqual(route[0], seatSide(seat, [6.5, 1.45]))
  })

  it('walks past other desks without crossing their chairs', () => {
    const grid = officeGrid(4)
    const chairs = [MAIN_DESK, ...[0, 1, 2, 3].map(deskSlotTile)].map(({ x, z }) => ({ x, z: z + 1 }))
    const route = planRoute(grid, { x: -1.1, z: 6.5 }, [12.4, 1.3])
    for (const [x, z] of route) {
      for (const chair of chairs) {
        const inside = x >= chair.x && x < chair.x + 2 && z >= chair.z && z < chair.z + 1
        assert.ok(!inside, `waypoint ${x},${z} is in the chair at ${chair.x},${chair.z}`)
      }
    }
  })

  it('lets bodies stand in the corridor and the doorway but not inside the wall', () => {
    const grid = officeGrid()
    assert.ok(canStandAt(grid, -1.1, 6.5))
    assert.ok(canStandAt(grid, -0.1, 6.5))
    assert.ok(!canStandAt(grid, -0.1, 3))
  })
})

describe('CoffeeSpots', () => {
  it('keeps the coffee machine away from the boss and the spots spread out', () => {
    const spots = new CoffeeSpots()
    const taken = Array.from({ length: 8 }, (_, i) => spots.occupy(`agent-${i}`))
    const [seatX, seatZ] = seatAt(MAIN_DESK)
    for (const [x, z] of taken) assert.ok(Math.hypot(x - seatX, z - seatZ) > 5)
    for (const [i, [x, z]] of taken.entries()) {
      for (const [ox, oz] of taken.slice(i + 1)) assert.ok(Math.hypot(x - ox, z - oz) >= 0.85)
    }
  })

  it('has a walkable spot for everyone, however many subagents there are', () => {
    for (let subagents = 0; subagents <= 60; subagents++) {
      const spots = new CoffeeSpots()
      const grid = officeGrid(subagents)
      for (let i = 0; i <= subagents; i++) {
        const [x, z] = spots.occupy(`agent-${i}`)
        assert.ok(canStandAt(grid, x, z), `${subagents} subagents: spot ${x},${z} is walkable`)
      }
    }
  })
})

describe('StationSpots', () => {
  it('stands agents sharing a station side by side, on walkable floor', () => {
    const spots = new StationSpots()
    const grid = officeGrid()
    const taken = Array.from({ length: 5 }, (_, i) => spots.occupy(`agent-${i}`, 'rack'))
    for (const [i, [x, z]] of taken.entries()) {
      assert.ok(canStandAt(grid, x, z))
      for (const [ox, oz] of taken.slice(i + 1)) assert.ok(Math.hypot(x - ox, z - oz) >= PERSONAL_SPACE)
    }
  })

  it('frees the spot when the agent moves to another station', () => {
    const spots = new StationSpots()
    spots.occupy('a', 'rack')
    spots.occupy('a', 'globe')
    assert.deepEqual(spots.occupy('b', 'rack'), [6.5, 1.45])
  })

  it('keeps the phone crowd clear of the coffee queue', () => {
    const phone = new StationSpots()
    const coffee = new CoffeeSpots()
    const phoneSpots = Array.from({ length: 5 }, (_, i) => phone.occupy(`p${i}`, 'phone'))
    const coffeeSpots = Array.from({ length: 7 }, (_, i) => coffee.occupy(`c${i}`))
    for (const [x, z] of phoneSpots) {
      for (const [cx, cz] of coffeeSpots) assert.ok(Math.hypot(x - cx, z - cz) >= PERSONAL_SPACE)
    }
  })
})

describe('Temper', () => {
  const now = 1_000_000
  /** @param {import('../../shared/protocol.js').ToolRecord[]} history */
  const situation = (history, fields = {}) => ({
    snapshot: agentSnapshot({ history }),
    now,
    atCoffee: false,
    coffeeToolId: null,
    ...fields,
  })
  const failed = (/** @type {string} */ id, endedAt = now - 100) => toolRecord({ id, endedAt, failed: true })

  it('grumbles at the first failure and punches the desk at the second', () => {
    const temper = new Temper()
    assert.equal(temper.react(situation([failed('a')])), 'grumble')
    assert.equal(temper.react(situation([failed('a')])), null, 'the same failure counts once')
    assert.equal(temper.react(situation([failed('a'), failed('b')])), 'punch')
  })

  it('only grumbles when the second failure comes more than two minutes later', () => {
    const temper = new Temper()
    temper.react(situation([failed('a')], { now: now - PUNCH_STREAK_MS - 1 }))
    assert.equal(temper.react(situation([failed('b')])), 'grumble')
  })

  it('ignores old failures, the coffee command and failures at the coffee machine', () => {
    assert.equal(new Temper().react(situation([failed('old', now - 60000)])), null)
    assert.equal(new Temper().react(situation([failed('build')], { coffeeToolId: 'build' })), null)
    assert.equal(new Temper().react(situation([failed('a')], { atCoffee: true })), null)
  })

  it('punches at most once every few seconds', () => {
    const temper = new Temper()
    temper.react(situation([failed('a')]))
    assert.equal(temper.react(situation([failed('b')])), 'punch')
    assert.equal(temper.react(situation([failed('c')])), 'grumble')
  })
})
