// The radio engine inside Godot's off-screen WebView (godot_wry): the web RadioController + StrudelWebEngine driven by
// Godot's commands (hostProtocol). Served from res://localhost/radio_host/ — godot_wry maps it to http://res.localhost,
// a secure context, so Strudel's AudioWorklets load (spec docs/superpowers/specs/2026-09-15-godot-radio-design.md).
import { dispatch, parseCommand, type HostEvent, type HostTarget } from './hostProtocol'
import { StrudelWebEngine } from '../music/StrudelWebEngine'
import { RadioController } from '../app/RadioController'
import { DEFAULT_RADIO_CONFIG } from '../music/radio/radioConfig'
import { validateBanks } from '../music/radio/banks'
import { warmupRadio } from '../warmup'
import moods from '../../../public/radio/moods.json'
import progressions from '../../../public/radio/progressions.json'
import drums from '../../../public/radio/drums.json'
import instruments from '../../../public/radio/instruments.json'
import scales from '../../../public/radio/scales.json'

const PROGRESS_MS = 100   // the player's scrub bar and time labels
const METER_MS = 33       // the visualizer and the menu edge glow read the output level every frame
const METER_BANDS = 8

interface GodotIpc { postMessage(message: string): void }

/** godot_wry injects window.ipc; Godot receives each message through the WebView's ipc_message signal. */
function post(event: HostEvent): void {
  (window as unknown as { ipc?: GodotIpc }).ipc?.postMessage(JSON.stringify(event))
}

let engine: StrudelWebEngine | null = null
let controller: RadioController | null = null
let warming = false
let canGenerate = true
const bands = new Float32Array(METER_BANDS)

const target: HostTarget = {
  init(volume) {
    if (controller || warming) return
    warming = true
    void warmupRadio({
      loadBanks: async () => validateBanks({ moods, progressions, drums, instruments, scales }),
      makeEngine: () => (engine = new StrudelWebEngine()),
      initEngine: (e) => e.init(),
      makeController: (e, banks) => new RadioController({
        engine: e, banks, config: DEFAULT_RADIO_CONFIG, volume,
        onState: (state) => post({ event: 'state', state }),
        onTrackEnd: () => post({ event: 'track-end' }),
        canGenerate: () => canGenerate,
        onGenerated: () => post({ event: 'generated' }),
      }),
    }, (state) => post({ event: 'init-state', state })).then((ready) => {
      controller = ready   // null after a failed warmup: the next init retries
      warming = false
    })
  },
  resume: () => void controller?.resume(),
  pause: () => void controller?.pause(),
  stop: () => controller?.stop(),
  next: () => controller?.next(),
  prev: () => controller?.prev(),
  resumeGenerative: () => controller?.resumeGenerative(),
  seek: (frac) => controller?.seekToFraction(frac),
  setVolume: (volume) => controller?.setVolume(volume),
  setGate: (value) => { canGenerate = value },
  playTrack: (seed, index) => controller?.playTrack(seed, index),
  playBaked: (track) => controller?.playBaked(track),
}

// godot_wry delivers WebView.post_message(text) as a `message` event on the document, the text in its detail.
document.addEventListener('message', (e) => {
  const command = parseCommand(String((e as CustomEvent).detail))
  if (command) dispatch(command, target)
})

setInterval(() => {
  if (controller) post({ event: 'progress', progress: controller.progress(), totalMs: controller.totalMs(), running: controller.isRunning })
}, PROGRESS_MS)

setInterval(() => {
  if (!engine?.isReady) return
  engine.readBands(bands)
  post({ event: 'meter', level: engine.readLevel(), bands: Array.from(bands) })
}, METER_MS)

post({ event: 'ready' })
