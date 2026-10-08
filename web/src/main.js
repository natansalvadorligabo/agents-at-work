// Composition root: the only module that touches globals (window, document, localStorage, EventSource)
// and hands them to everything else.
import { systemIntervalTimer } from '#shared/interval-timer.js'
import { ControlClient } from './app/control-client.js'
import { takeControlKey } from './app/control-key.js'
import { SessionSync } from './app/session-sync.js'
import { SoundBoard } from './audio/sound-board.js'
import { SoundPreference } from './audio/sound-preference.js'
import { listenToStream, streamUrl } from './app/stream-client.js'
import { systemClock, systemRandom, systemScheduler } from './core/clock.js'
import { LocalePreference } from './i18n/locale-preference.js'
import { en } from './i18n/locales/en.js'
import { ptBr } from './i18n/locales/pt-br.js'
import { Translator, detectLocale } from './i18n/translator.js'
import { DetailsPanel } from './ui/details-panel.js'
import { HeaderView } from './ui/header-view.js'
import { LanguageSwitcher } from './ui/language-switcher.js'
import { SoundToggle } from './ui/sound-toggle.js'
import { applyStaticTranslations } from './ui/static-text.js'
import { CameraInput } from './world/camera-input.js'
import { DomLabelLayer } from './world/dom-label-layer.js'
import { Office } from './world/office.js'
import { createWebGlRenderer, toDeviceCoordinates } from './world/renderer.js'

const DEFAULT_IDLE_MS = 45000

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function byId(id) {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}; expected it in web/index.html`)
  return element
}

/**
 * @param {'localStorage' | 'sessionStorage'} name
 * @returns {import('./i18n/locale-preference.js').KeyValueStorage | null}
 */
function browserStorage(name) {
  try {
    return window[name]
  } catch {
    return null
  }
}

// The key arrives in the /office link; it is moved to tab storage and dropped from the address bar.
function createControlClient() {
  const { key, cleanUrl } = takeControlKey(new URL(location.href), browserStorage('sessionStorage'))
  history.replaceState(null, '', cleanUrl)
  return new ControlClient({ fetch: (url, init) => window.fetch(url, init), key })
}

/** @param {LocalePreference} preference */
function createTranslator(preference) {
  const translator = new Translator(
    { en, 'pt-BR': ptBr },
    detectLocale(preference.load(), navigator.languages),
  )
  applyStaticTranslations(document, translator)
  translator.onChange(() => applyStaticTranslations(document, translator))
  new LanguageSwitcher({ container: byId('language'), translator, preference })
  return translator
}

/**
 * `?idle=<seconds>` shortens the time before the office naps, handy for demos.
 * @param {URLSearchParams} params
 */
function idleMsFrom(params) {
  const seconds = Number(params.get('idle'))
  return seconds > 0 ? seconds * 1000 : DEFAULT_IDLE_MS
}

/**
 * Browsers keep audio silent until the viewer interacts with the page; the first click or key unlocks it.
 * @param {Translator} translator
 */
function createSounds(translator) {
  const sounds = new SoundBoard({
    createContext: () => new AudioContext(),
    clock: systemClock,
    random: systemRandom,
  })
  new SoundToggle({
    button: byId('sound'),
    sounds,
    preference: new SoundPreference(browserStorage('localStorage')),
    translator,
  })
  const unlock = () => sounds.unlock()
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, unlock, { passive: true })
  return sounds
}

/**
 * @param {Translator} translator
 * @param {URLSearchParams} params
 * @param {SoundBoard} sounds
 */
function createOffice(translator, params, sounds) {
  const container = byId('scene')
  const renderer = createWebGlRenderer(container, window.devicePixelRatio)
  const office = new Office({
    renderer,
    labels: new DomLabelLayer(byId('labels')),
    clock: systemClock,
    scheduler: systemScheduler,
    random: systemRandom,
    translator,
    idleMs: idleMsFrom(params),
    logError: (message, error) => console.error(message, error),
    sounds,
  })
  const fit = () => office.resize(container.clientWidth, container.clientHeight)
  window.addEventListener('resize', fit)
  fit()
  renderer.setAnimationLoop(() => office.frame())
  return { office, canvas: renderer.domElement }
}

/**
 * @param {Office} office
 * @param {HTMLCanvasElement} canvas
 * @param {DetailsPanel} panel
 */
function wireSelection(office, canvas, panel) {
  const input = new CameraInput(canvas, office.cameraRig)
  canvas.addEventListener('click', event => {
    if (input.wasDrag) return
    const { x, y } = toDeviceCoordinates(event, canvas.getBoundingClientRect())
    const picked = office.pick(x, y)
    if (picked.kind === 'agent') panel.openAgent(picked.agentId)
    else if (picked.kind === 'coffee') panel.openRanking()
    else panel.close()
  })
}

/** @param {Office} office @param {Translator} translator */
function createHeader(office, translator) {
  const elements = {
    project: byId('project'),
    connection: byId('connection'),
    endedNotice: byId('session-ended'),
    recenter: byId('recenter'),
  }
  const header = new HeaderView(elements, translator)
  office.cameraRig.onManualChange = manual => header.setRecenterVisible(manual)
  elements.recenter.addEventListener('click', () => office.cameraRig.recenter())
  return header
}

/**
 * @param {Office} office
 * @param {SessionSync} sync
 * @param {Translator} translator
 * @param {ControlClient} permissions
 */
function createPanel(office, sync, translator, permissions) {
  return new DetailsPanel({
    element: byId('panel'),
    snapshotOf: agentId => sync.snapshotOf(agentId),
    coffee: { statFor: agentId => office.coffeeStatFor(agentId), ranking: () => office.coffeeRanking() },
    translator,
    clock: systemClock,
    timer: systemIntervalTimer,
    nextFrame: callback => void requestAnimationFrame(() => callback()),
    permissions,
  })
}

/**
 * @param {SessionSync} sync
 * @param {HeaderView} header
 */
function connectStream(sync, header) {
  listenToStream(new EventSource(streamUrl(sync.sessionId)), {
    onSnapshot: session => sync.applySnapshot(session),
    onUpdate: update => sync.applyUpdate(update),
    onConnectionChange: connected => header.setConnected(connected),
  })
}

function start() {
  const params = new URLSearchParams(location.search)
  const translator = createTranslator(new LocalePreference(browserStorage('localStorage')))
  const { office, canvas } = createOffice(translator, params, createSounds(translator))
  const header = createHeader(office, translator)
  // The panel reads snapshots from the sync, and the sync tells the panel what changed: break the cycle.
  const panelRef = { current: /** @type {DetailsPanel | null} */ (null) }
  const sync = new SessionSync({
    office,
    showSession: session => header.showSession(session),
    onAgentChanged: agentId => panelRef.current?.notifyAgentChanged(agentId),
    onPermissionRequested: agentId => panelRef.current?.openAgent(agentId),
    sessionId: params.get('session'),
  })
  panelRef.current = createPanel(office, sync, translator, createControlClient())
  wireSelection(office, canvas, panelRef.current)
  connectStream(sync, header)
}

start()
