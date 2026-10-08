import { pickRandom } from '../core/clock.js'
import { interpolate } from '../i18n/translator.js'

/**
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../core/clock.js').Scheduler} Scheduler
 * @typedef {import('../core/clock.js').RandomSource} RandomSource
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../agents/speech-bubble.js').BubbleOptions} BubbleOptions
 *
 * Someone standing at the coffee machine who can chat.
 * @typedef {object} GossipParticipant
 * @property {string} id
 * @property {boolean} canGossip Idle at the coffee machine and not already chatting.
 * @property {boolean} isAtCoffee
 * @property {(partner: GossipParticipant, ms: number) => void} chatWith
 * @property {(text: string, options: BubbleOptions) => void} say
 * @property {{ x: number, z: number }} position
 *
 * What the lines may mention about the rest of the office.
 * @typedef {object} GossipContext
 * @property {(excludedIds: string[]) => string | null} nameSomeoneElse A random absent colleague, if any.
 * @property {(agentId: string) => number} cupsOf
 */

const WAIT_BEFORE_GOSSIP_MS = 1500
const LINE_DURATION_MS = 2800
const PAUSE_BEFORE_REPLY_MS = 200
const INTERVAL_BETWEEN_GOSSIP_MS = 9000

/**
 * When two or more agents idle at the coffee machine, one starts a line of office gossip and another replies.
 * @example
 * const director = new GossipDirector({ clock, scheduler, random, translator })
 * director.update(availableParticipants, context) // once per frame
 */
export class GossipDirector {
  #possibleSince = 0
  #nextAllowedAt = 0
  #clock
  #scheduler
  #random
  #translator

  /** @param {{ clock: Clock, scheduler: Scheduler, random: RandomSource, translator: Translator }} dependencies */
  constructor({ clock, scheduler, random, translator }) {
    this.#clock = clock
    this.#scheduler = scheduler
    this.#random = random
    this.#translator = translator
  }

  /**
   * @param {GossipParticipant[]} participants Everyone currently able to gossip.
   * @param {GossipContext} context
   */
  update(participants, context) {
    const now = this.#clock.now()
    if (participants.length < 2) {
      this.#possibleSince = 0
      return
    }
    if (!this.#possibleSince) this.#possibleSince = now
    if (now - this.#possibleSince < WAIT_BEFORE_GOSSIP_MS || now < this.#nextAllowedAt) return
    this.#nextAllowedAt = now + INTERVAL_BETWEEN_GOSSIP_MS
    const [speaker, listener] = this.#pickPair(participants)
    this.#converse(speaker, listener, context)
  }

  /**
   * @param {GossipParticipant[]} participants
   * @returns {[GossipParticipant, GossipParticipant]}
   */
  #pickPair(participants) {
    const speaker = pickRandom(participants, this.#random)
    const listener = pickRandom(
      participants.filter(participant => participant !== speaker),
      this.#random,
    )
    return [speaker, listener]
  }

  /**
   * @param {GossipParticipant} speaker
   * @param {GossipParticipant} listener
   * @param {GossipContext} context
   */
  #converse(speaker, listener, context) {
    const [line, reply] = this.#writeLines(speaker, listener, context)
    const conversationMs = LINE_DURATION_MS * 2 + PAUSE_BEFORE_REPLY_MS * 2
    speaker.chatWith(listener, conversationMs)
    listener.chatWith(speaker, conversationMs)
    speaker.say(this.#translator.t('coffee.gossipSay', { line }), {
      durationMs: LINE_DURATION_MS,
      priority: true,
    })
    this.#scheduler.after(LINE_DURATION_MS + PAUSE_BEFORE_REPLY_MS, () => {
      if (!listener.isAtCoffee) return
      listener.say(this.#translator.t('coffee.gossipReply', { line: reply }), {
        durationMs: LINE_DURATION_MS,
        priority: true,
      })
    })
  }

  /**
   * @param {GossipParticipant} speaker
   * @param {GossipParticipant} listener
   * @param {GossipContext} context
   * @returns {[string, string]}
   */
  #writeLines(speaker, listener, context) {
    const someone = context.nameSomeoneElse([speaker.id, listener.id]) ?? this.#translator.t('coffee.someone')
    const params = { someone, otherCups: context.cupsOf(listener.id) }
    const [line, reply] = pickRandom(this.#translator.gossipTemplates(), this.#random)
    return [interpolate(line, params), interpolate(reply, params)]
  }
}
