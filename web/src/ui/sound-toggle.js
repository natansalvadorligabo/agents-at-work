/**
 * @typedef {import('../i18n/translator.js').Translator} Translator
 * @typedef {import('../audio/sound-preference.js').SoundPreference} SoundPreference
 *
 * The slice of the sound board the button controls.
 * @typedef {{ muted: boolean, unlock: () => void }} Mutable
 */

/**
 * The 🔊/🔇 button in the top bar. Its click also counts as the user gesture browsers want before audio.
 * @example new SoundToggle({ button, sounds, preference, translator })
 */
export class SoundToggle {
  #button
  #sounds
  #preference
  #translator

  /** @param {{ button: HTMLElement, sounds: Mutable, preference: SoundPreference, translator: Translator }} dependencies */
  constructor({ button, sounds, preference, translator }) {
    this.#button = button
    this.#sounds = sounds
    this.#preference = preference
    this.#translator = translator
    sounds.muted = preference.loadMuted()
    button.addEventListener('click', () => this.#toggle())
    translator.onChange(() => this.#render())
    this.#render()
  }

  #toggle() {
    this.#sounds.muted = !this.#sounds.muted
    this.#preference.save(this.#sounds.muted)
    this.#sounds.unlock()
    this.#render()
  }

  #render() {
    const { muted } = this.#sounds
    const label = this.#translator.t(muted ? 'header.soundOff' : 'header.soundOn')
    this.#button.textContent = muted ? '🔇' : '🔊'
    this.#button.setAttribute('title', label)
    this.#button.setAttribute('aria-label', label)
    this.#button.setAttribute('aria-pressed', String(!muted))
  }
}
