import { CUPS_TO_FEEL_GREAT, SHAKE_DURATION_MS } from './coffee-rules.js'

/**
 * @typedef {import('#shared/protocol.js').AgentSnapshot} AgentSnapshot
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../agents/character.js').Character} Character
 * @typedef {import('../agents/office-ports.js').OfficePorts} OfficePorts
 * @typedef {import('./coffee-rules.js').CoffeeVisit} CoffeeVisit
 * @typedef {{ x: number, z: number }} FloorPosition
 */

const FEELING_GREAT_BUBBLE_MS = 3500

/**
 * One agent's coffee break: arriving (and counting cups), chatting, leaving, and noticing when the command
 * it was waiting for failed.
 * @example
 * const coffeeBreak = new CoffeeBreak({ character, ports, clock, translator })
 * coffeeBreak.arrive()
 */
export class CoffeeBreak {
  atCoffee = false
  /** @type {CoffeeVisit | null} */
  visit = null
  /** @type {FloorPosition | null} */
  chatPartner = null
  chatUntil = 0
  #character
  #ports
  #clock
  #translator

  /** @param {{ character: Character, ports: OfficePorts, clock: Clock, translator: Translator }} dependencies */
  constructor({ character, ports, clock, translator }) {
    this.#character = character
    this.#ports = ports
    this.#clock = clock
    this.#translator = translator
  }

  get isChatting() {
    return this.#clock.now() < this.chatUntil
  }

  /** The person to face while chatting, if a chat is going on. */
  get currentPartner() {
    return this.isChatting ? this.chatPartner : null
  }

  /** Counts the cup; from the fifth on, the agent shakes and brags about it. */
  arrive() {
    this.atCoffee = true
    const cups = this.#ports.recordCoffeeArrival(this.#character.snapshot)
    if (cups < CUPS_TO_FEEL_GREAT) return
    this.#character.shake(SHAKE_DURATION_MS)
    const text = this.#translator.t('coffee.feelingGreat', { count: cups })
    this.#character.bubble.show(text, { durationMs: FEELING_GREAT_BUBBLE_MS, priority: true })
  }

  leave() {
    if (this.atCoffee) this.#ports.recordCoffeeDeparture(this.#character.id)
    this.atCoffee = false
    this.visit = null
    this.chatPartner = null
    this.chatUntil = 0
    this.#ports.releaseCoffeeSpot(this.#character.id)
  }

  /**
   * @param {FloorPosition} partner
   * @param {number} ms
   */
  chatWith(partner, ms) {
    this.chatPartner = partner
    this.chatUntil = this.#clock.now() + ms
  }

  /**
   * Checks the command that sent the agent for coffee. Once it ends the visit is over; the answer is true
   * only when it failed while the agent was still at the coffee machine (time to spill the coffee).
   * @param {AgentSnapshot} snapshot
   * @returns {boolean}
   */
  commandFailedHere(snapshot) {
    const visit = this.visit
    if (!visit || visit.reason !== 'compiling') return false
    const record = snapshot.history.find(item => item.id === visit.toolUseId)
    if (!record?.endedAt) return false
    this.visit = null
    return record.failed && this.atCoffee
  }
}
