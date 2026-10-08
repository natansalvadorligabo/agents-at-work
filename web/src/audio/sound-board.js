/**
 * @typedef {import('../core/clock.js').Clock} Clock
 * @typedef {import('../core/clock.js').RandomSource} RandomSource
 *
 * @typedef {'door' | 'whoosh' | 'paper' | 'success' | 'failure' | 'pop' | 'poof' | 'typing' | 'pageFlip'
 *   | 'marker' | 'serverBeep' | 'globeSpin' | 'phoneRing' | 'brew' | 'splash' | 'jitter' | 'gossip'
 *   | 'snore' | 'grumble' | 'punch'} SoundName
 *
 * What the office needs to make noise; tests pass a fake.
 * @typedef {object} SoundPlayer
 * @property {(name: SoundName) => void} play
 *
 * @typedef {object} ToneOptions
 * @property {number} frequency Hz at the start.
 * @property {number} [endFrequency] Hz at the end (slides exponentially).
 * @property {number} duration Seconds.
 * @property {OscillatorType} [type]
 * @property {number} [gain]
 * @property {number} [delay] Seconds after now.
 *
 * @typedef {object} NoiseOptions
 * @property {number} duration Seconds.
 * @property {BiquadFilterType} [filter]
 * @property {number} frequency Filter frequency at the start.
 * @property {number} [endFrequency] Filter frequency at the end.
 * @property {number} [q]
 * @property {number} [gain]
 * @property {number} [delay] Seconds after now.
 * @property {number} [attack] Seconds to fade in.
 */

const MASTER_VOLUME = 0.35
const NOISE_SECONDS = 1

/**
 * Minimum time between two plays of the same sound, so a busy office does not turn into noise.
 * @type {Readonly<Record<SoundName, number>>}
 */
const MIN_GAP_MS = Object.freeze({
  door: 900,
  whoosh: 150,
  paper: 150,
  success: 300,
  failure: 300,
  pop: 200,
  poof: 200,
  typing: 320,
  pageFlip: 600,
  marker: 1400,
  serverBeep: 600,
  globeSpin: 900,
  phoneRing: 1500,
  brew: 1500,
  splash: 300,
  jitter: 800,
  gossip: 400,
  snore: 3200,
  grumble: 1000,
  punch: 300,
})

/**
 * Every office sound, synthesized on the fly with Web Audio: no audio files to ship or load. Browsers only
 * let audio start after a user gesture, so the context is created (or resumed) on `unlock()`.
 * @implements {SoundPlayer}
 * @example
 * const board = new SoundBoard({ createContext: () => new AudioContext(), clock, random })
 * window.addEventListener('pointerdown', () => board.unlock())
 * board.play('pop')
 */
export class SoundBoard {
  muted = false
  /** @type {AudioContext | null} */
  #context = null
  /** @type {GainNode | null} */
  #master = null
  /** @type {AudioBuffer | null} */
  #noise = null
  /** @type {Map<SoundName, number>} */
  #lastPlayedAt = new Map()
  #createContext
  #clock
  #random

  /**
   * @param {{ createContext: () => AudioContext, clock: Clock, random: RandomSource }} dependencies
   */
  constructor({ createContext, clock, random }) {
    this.#createContext = createContext
    this.#clock = clock
    this.#random = random
  }

  /** @returns {number} In [0, 1), for small variations between plays. */
  random() {
    return this.#random()
  }

  /** Creates or resumes the audio context; call it from a user gesture. */
  unlock() {
    if (!this.#context) this.#setUp()
    if (this.#context?.state === 'suspended') void this.#context.resume()
  }

  /** @param {SoundName} name */
  play(name) {
    const context = this.#context
    if (this.muted || !context || context.state !== 'running') return
    const now = this.#clock.now()
    if (now - (this.#lastPlayedAt.get(name) ?? -Infinity) < MIN_GAP_MS[name]) return
    this.#lastPlayedAt.set(name, now)
    SOUNDS[name](this)
  }

  /** @param {ToneOptions} options */
  tone({ frequency, endFrequency, duration, type = 'sine', gain = 0.3, delay = 0 }) {
    const context = this.#context
    if (!context || !this.#master) return
    const start = context.currentTime + delay
    const oscillator = context.createOscillator()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    const envelope = this.#envelope(start, duration, gain, 0.005)
    oscillator.connect(envelope)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  /** @param {NoiseOptions} options */
  noise({
    duration,
    filter = 'bandpass',
    frequency,
    endFrequency,
    q = 1,
    gain = 0.3,
    delay = 0,
    attack = 0.005,
  }) {
    const context = this.#context
    if (!context || !this.#master || !this.#noise) return
    const start = context.currentTime + delay
    const source = context.createBufferSource()
    source.buffer = this.#noise
    const biquad = context.createBiquadFilter()
    biquad.type = filter
    biquad.Q.value = q
    biquad.frequency.setValueAtTime(frequency, start)
    if (endFrequency) biquad.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    source.connect(biquad).connect(this.#envelope(start, duration, gain, attack))
    source.start(start, this.#random() * (NOISE_SECONDS - Math.min(duration, NOISE_SECONDS) * 0.9))
    source.stop(start + duration + 0.02)
  }

  #setUp() {
    try {
      const context = this.#createContext()
      const master = context.createGain()
      master.gain.value = MASTER_VOLUME
      master.connect(context.destination)
      this.#noise = whiteNoise(context, this.#random)
      this.#context = context
      this.#master = master
    } catch {
      // No Web Audio (old browser, blocked by policy): the office stays silent.
    }
  }

  /**
   * A gain node that fades in, holds and decays, connected to the master volume.
   * @param {number} start
   * @param {number} duration
   * @param {number} gain
   * @param {number} attack
   * @returns {GainNode}
   */
  #envelope(start, duration, gain, attack) {
    const context = /** @type {AudioContext} */ (this.#context)
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(attack, duration / 2))
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    envelope.connect(/** @type {GainNode} */ (this.#master))
    return envelope
  }
}

/**
 * @param {AudioContext} context
 * @param {RandomSource} random
 * @returns {AudioBuffer}
 */
function whiteNoise(context, random) {
  const buffer = context.createBuffer(1, context.sampleRate * NOISE_SECONDS, context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1
  return buffer
}

/**
 * How each sound is made. Pitches get a little random variation so repeated sounds do not grate.
 * @type {Readonly<Record<SoundName, (board: SoundBoard) => void>>}
 */
const SOUNDS = Object.freeze({
  door: board => {
    board.tone({ frequency: 190, endFrequency: 120, duration: 0.45, type: 'sawtooth', gain: 0.05 })
    board.noise({ duration: 0.4, filter: 'bandpass', frequency: 900, endFrequency: 500, q: 8, gain: 0.08 })
    board.noise({ duration: 0.12, filter: 'lowpass', frequency: 300, gain: 0.25, delay: 0.42 })
  },
  whoosh: board => {
    board.noise({ duration: 0.4, frequency: 500, endFrequency: 2600, q: 2, gain: 0.18, attack: 0.12 })
  },
  paper: board => {
    board.noise({ duration: 0.09, filter: 'highpass', frequency: 2500, gain: 0.15 })
    board.noise({ duration: 0.07, filter: 'highpass', frequency: 3500, gain: 0.1, delay: 0.06 })
  },
  success: board => {
    board.tone({ frequency: 660, duration: 0.18, type: 'triangle', gain: 0.22 })
    board.tone({ frequency: 990, duration: 0.35, type: 'triangle', gain: 0.22, delay: 0.12 })
  },
  failure: board => {
    board.tone({ frequency: 392, endFrequency: 370, duration: 0.28, type: 'triangle', gain: 0.2 })
    board.tone({
      frequency: 330,
      endFrequency: 300,
      duration: 0.28,
      type: 'triangle',
      gain: 0.2,
      delay: 0.26,
    })
    board.tone({ frequency: 262, endFrequency: 200, duration: 0.6, type: 'triangle', gain: 0.2, delay: 0.52 })
  },
  pop: board => {
    board.tone({ frequency: 280 + board.random() * 60, endFrequency: 900, duration: 0.13, gain: 0.25 })
  },
  poof: board => {
    board.tone({ frequency: 800, endFrequency: 180, duration: 0.2, gain: 0.18 })
    board.noise({ duration: 0.25, filter: 'lowpass', frequency: 1200, endFrequency: 300, gain: 0.12 })
  },
  typing: board => {
    for (let i = 0; i < 4; i++) {
      const frequency = 2600 + board.random() * 1600
      board.noise({
        duration: 0.025,
        filter: 'highpass',
        frequency,
        gain: 0.06,
        delay: i * 0.06 + board.random() * 0.03,
      })
    }
  },
  pageFlip: board => {
    board.noise({ duration: 0.22, frequency: 1800, endFrequency: 5000, q: 0.8, gain: 0.12, attack: 0.05 })
  },
  marker: board => {
    board.tone({ frequency: 1900, endFrequency: 2500, duration: 0.12, type: 'square', gain: 0.025 })
    board.tone({
      frequency: 2300,
      endFrequency: 1800,
      duration: 0.14,
      type: 'square',
      gain: 0.025,
      delay: 0.18,
    })
  },
  serverBeep: board => {
    board.tone({ frequency: 1320, duration: 0.07, type: 'square', gain: 0.05 })
    board.tone({ frequency: 1760, duration: 0.09, type: 'square', gain: 0.05, delay: 0.1 })
  },
  globeSpin: board => {
    board.noise({ duration: 0.7, frequency: 300, endFrequency: 1400, q: 3, gain: 0.1, attack: 0.1 })
  },
  phoneRing: board => {
    for (let i = 0; i < 6; i++) {
      board.tone({ frequency: i % 2 ? 480 : 440, duration: 0.07, gain: 0.12, delay: i * 0.08 })
    }
  },
  brew: board => {
    board.noise({ duration: 1.2, filter: 'lowpass', frequency: 500, gain: 0.12, attack: 0.2 })
    for (let i = 0; i < 7; i++) {
      board.tone({
        frequency: 180 + board.random() * 220,
        endFrequency: 500,
        duration: 0.06,
        gain: 0.08,
        delay: 0.15 + i * 0.13,
      })
    }
  },
  splash: board => {
    board.tone({ frequency: 2200, endFrequency: 1900, duration: 0.15, type: 'triangle', gain: 0.12 })
    board.noise({
      duration: 0.55,
      filter: 'lowpass',
      frequency: 2400,
      endFrequency: 400,
      gain: 0.3,
      delay: 0.05,
    })
  },
  jitter: board => {
    for (let i = 0; i < 10; i++) {
      board.tone({
        frequency: 600 + (i % 2) * 140,
        duration: 0.04,
        type: 'square',
        gain: 0.04,
        delay: i * 0.045,
      })
    }
  },
  gossip: board => {
    for (let i = 0; i < 5; i++) {
      board.tone({
        frequency: 380 + board.random() * 320,
        duration: 0.07,
        type: 'square',
        gain: 0.035,
        delay: i * 0.09,
      })
    }
  },
  snore: board => {
    board.noise({ duration: 1.1, filter: 'lowpass', frequency: 260, gain: 0.14, attack: 0.5 })
    board.tone({ frequency: 70, endFrequency: 55, duration: 1.0, type: 'sawtooth', gain: 0.03, delay: 0.1 })
  },
  grumble: board => {
    board.tone({ frequency: 120, endFrequency: 95, duration: 0.45, type: 'sawtooth', gain: 0.07 })
    board.tone({
      frequency: 126,
      endFrequency: 90,
      duration: 0.45,
      type: 'sawtooth',
      gain: 0.05,
      delay: 0.03,
    })
  },
  punch: board => {
    board.tone({ frequency: 140, endFrequency: 45, duration: 0.22, gain: 0.5 })
    board.noise({ duration: 0.18, filter: 'lowpass', frequency: 900, endFrequency: 200, gain: 0.45 })
    for (let i = 0; i < 5; i++) {
      const frequency = 1800 + board.random() * 1500
      board.noise({ duration: 0.03, filter: 'bandpass', frequency, q: 6, gain: 0.12, delay: 0.08 + i * 0.07 })
    }
  },
})
