// Types only: what an AgentController needs from the office around it. The real office implements it;
// tests pass a FakeOfficePorts. Keeping this narrow is what lets the behavior be tested without WebGL.

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('../models/props.js').DeliveryKind} DeliveryKind
 * @typedef {import('../world/layout.js').Point2} Point2
 * @typedef {import('../world/layout.js').StationName} StationName
 * @typedef {import('./character.js').Character} Character
 * @typedef {import('../audio/sound-board.js').SoundName} SoundName
 *
 * @typedef {object} OfficePorts
 * @property {(position: { x: number, z: number }, destination: Point2) => Point2[]} planRoute
 * @property {(agentId: string) => Point2} seatOf
 * @property {(agentId: string) => Point2} occupyCoffeeSpot
 * @property {(agentId: string) => void} releaseCoffeeSpot
 * @property {(agentId: string, station: StationName) => Point2} occupyStationSpot
 * @property {(agentId: string) => void} releaseStationSpot
 * @property {(agent: AgentSnapshot) => number} recordCoffeeArrival Returns the agent's cup count.
 * @property {(agentId: string) => void} recordCoffeeDeparture
 * @property {(x: number, z: number) => void} spillCoffee
 * @property {(characters: Character[], ms: number) => void} focusOn
 * @property {(from: Character, to: Character, kind: DeliveryKind) => Promise<void>} deliver
 * @property {(parentId: string, childId: string) => Character | undefined} parentCharacter
 *   The parent, or the main agent when the parent is gone or leaving.
 * @property {(agentId: string) => boolean} isAtCoffee
 * @property {(agentId: string) => number} childCountOf Subagents still in the office, leaving ones included.
 * @property {(agentId: string) => number} arrivingChildCountOf Subagents on their way in for their task.
 * @property {(agentId: string) => void} removeAgent
 * @property {() => boolean} isIdle Nobody has done anything for a while: time for a nap.
 * @property {(name: SoundName) => void} playSound
 * @property {(agentId: string) => void} punchDesk Shakes the agent's desk and monitor, with a bang.
 */

export {}
