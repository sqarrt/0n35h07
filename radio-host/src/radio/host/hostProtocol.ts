// The Godot radio host's message protocol (spec docs/superpowers/specs/2026-09-15-godot-radio-design.md): the commands
// Godot posts into the off-screen WebView page and the events the page posts back. Pure — commands are parsed and
// dispatched here, executed by radioHost.ts against the web RadioController.
import type { BakedTrack } from '../trackDescriptor'
import type { MusicalState } from '../music/radio/MusicalState'
import type { RadioInitState } from '../warmup'

export type HostCommand =
  | { cmd: 'init'; volume: number }
  | { cmd: 'resume' }
  | { cmd: 'pause' }
  | { cmd: 'stop' }
  | { cmd: 'next' }
  | { cmd: 'prev' }
  | { cmd: 'resume-generative' }
  | { cmd: 'seek'; frac: number }
  | { cmd: 'volume'; value: number }
  | { cmd: 'gate'; canGenerate: boolean }
  | { cmd: 'play-track'; seed: string; index: number }
  | { cmd: 'play-baked'; track: BakedTrack }

export type HostEvent =
  | { event: 'ready' }
  | { event: 'init-state'; state: RadioInitState }
  | { event: 'state'; state: MusicalState }
  | { event: 'progress'; progress: number; totalMs: number; running: boolean; bars: number }
  | { event: 'meter'; level: number; bands: number[]; visBands: number[] }
  | { event: 'track-end' }
  | { event: 'generated' }

/** What the page drives: the radio controller plus the host's own warmup and generation gate. */
export interface HostTarget {
  init(volume: number): void
  resume(): void
  pause(): void
  stop(): void
  next(): void
  prev(): void
  resumeGenerative(): void
  seek(frac: number): void
  setVolume(volume: number): void
  setGate(canGenerate: boolean): void
  playTrack(seed: string, index: number): void
  playBaked(track: BakedTrack): void
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isBakedTrack(v: unknown): v is BakedTrack {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Record<string, unknown>
  return typeof t.name === 'string' && isNumber(t.bpm) && isNumber(t.bars) && typeof t.program === 'string'
    && typeof t.info === 'object' && t.info !== null
}

/** A command from Godot's JSON text, or null for anything malformed (the page ignores it). */
export function parseCommand(text: string): HostCommand | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (typeof raw !== 'object' || raw === null) return null
  const m = raw as Record<string, unknown>
  switch (m.cmd) {
    case 'init': return isNumber(m.volume) ? { cmd: 'init', volume: m.volume } : null
    case 'resume': return { cmd: 'resume' }
    case 'pause': return { cmd: 'pause' }
    case 'stop': return { cmd: 'stop' }
    case 'next': return { cmd: 'next' }
    case 'prev': return { cmd: 'prev' }
    case 'resume-generative': return { cmd: 'resume-generative' }
    case 'seek': return isNumber(m.frac) ? { cmd: 'seek', frac: m.frac } : null
    case 'volume': return isNumber(m.value) ? { cmd: 'volume', value: m.value } : null
    case 'gate': return typeof m.canGenerate === 'boolean' ? { cmd: 'gate', canGenerate: m.canGenerate } : null
    case 'play-track':
      return typeof m.seed === 'string' && isNumber(m.index) ? { cmd: 'play-track', seed: m.seed, index: m.index } : null
    case 'play-baked': return isBakedTrack(m.track) ? { cmd: 'play-baked', track: m.track } : null
    default: return null
  }
}

/** Run one command against the target. */
export function dispatch(command: HostCommand, target: HostTarget): void {
  switch (command.cmd) {
    case 'init': target.init(command.volume); break
    case 'resume': target.resume(); break
    case 'pause': target.pause(); break
    case 'stop': target.stop(); break
    case 'next': target.next(); break
    case 'prev': target.prev(); break
    case 'resume-generative': target.resumeGenerative(); break
    case 'seek': target.seek(command.frac); break
    case 'volume': target.setVolume(command.value); break
    case 'gate': target.setGate(command.canGenerate); break
    case 'play-track': target.playTrack(command.seed, command.index); break
    case 'play-baked': target.playBaked(command.track); break
  }
}
