import { lsGet, lsSet } from './storage'
import { PLAYER_COLORS, BALL_MODELS, WINDUP_STYLES, RESPAWN_STYLES, DASH_STYLES, SHIELD_STYLES } from './constants'
import type { BallModel, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from './constants'
import { LOCALES } from './i18n'
import type { LocaleId } from './i18n'
import { generateModelName } from './names'
import { decodeBallArt } from './game/ballArt'
import type { FavoriteTrack, BakedSection } from './radio/trackDescriptor'

export type DefaultView = 'fp' | 'tp'
export type SearchRole = 'both' | 'client'   // 'both' (host/client as luck has it) | client only. No explicit host (unreliable).

export interface PlayerProfile {
  name: string
  primaryColor: string
  reserveColor: string
  defaultView: DefaultView   // starting view (local preference, not networked)
  searchRole: SearchRole     // default network role in the lobby; local preference
  ballModel: BallModel       // sphere model (networked cosmetic)
  windupStyle: WindupStyle   // shot windup animation (networked cosmetic)
  respawnStyle: RespawnStyle // respawn animation (networked cosmetic)
  dashStyle: DashStyle       // dash trail skin (networked cosmetic)
  shieldStyle: ShieldStyle   // shield skin (networked cosmetic)
  ballArt?: string           // ball artwork (base64, front/back 32×32); undefined = empty (networked cosmetic)
  postProcessing: boolean    // graphics: on-screen edge outline (post-processing); local preference
  showFps: boolean           // overlay: frame counter (FPS); local preference
  showSpeed: boolean         // overlay: current player speed; local preference
  menuGlow: boolean          // graphics: models glow to sound in the menu; local preference
  audioViz: boolean          // graphics: frequency visualizer line in the match; local preference
  volumeMaster: number       // audio: master level 0..1 (multiplies music and effects); local preference
  volumeMusic: number        // audio: match music 0..1; local preference
  volumeSfx: number          // audio: effects 0..1; local preference
  volumeMenuMusic: number    // audio: menu music 0..1; local preference
  radioEnabled: boolean      // audio: generative "Radio" mode replaces stem music when on; local preference
  volumeRadio: number        // audio: radio level 0..1; local preference
  favorites: FavoriteTrack[]     // radio: liked tracks (baked render replayed verbatim)
  connectTimeoutSec: number  // network: room connect timeout (seconds); local preference
  locale?: LocaleId          // UI language; undefined = not chosen (detect system)
}

export const CONNECT_TIMEOUT_OPTIONS = [5, 10, 20, 30, 60, 90, 120] as const   // connect timeout options (s)
const CONNECT_TIMEOUT_DEFAULT = 10

const KEY = 'oneshot:profile'
export const NAME_MAX = 16

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

/** First-run profile: generated "model" name + random color pair. */
function randomProfile(): PlayerProfile {
  const primaryColor = pick(PLAYER_COLORS)
  const reserveColor = pick(PLAYER_COLORS.filter(c => c !== primaryColor))
  return { name: generateModelName(), primaryColor, reserveColor, defaultView: 'fp', searchRole: 'both', ballModel: 'smooth', windupStyle: 'classic', respawnStyle: 'echo', dashStyle: 'streak', shieldStyle: 'dome', postProcessing: true, showFps: false, showSpeed: false, menuGlow: true, audioViz: true, volumeMaster: VOL_DEFAULT.master, volumeMusic: VOL_DEFAULT.music, volumeSfx: VOL_DEFAULT.sfx, volumeMenuMusic: VOL_DEFAULT.menuMusic, radioEnabled: false, volumeRadio: VOL_DEFAULT.radio, favorites: [], connectTimeoutSec: CONNECT_TIMEOUT_DEFAULT }
}

// Cap on the radio favorites list (Steam-Cloud synced in the profile — keep it bounded).
const RADIO_LIST_CAP = 200

/** Validate a baked render (the full arc's Strudel code), if present. Returns undefined if malformed. */
function sanitizeBaked(v: unknown): { name: string; sections: BakedSection[] } | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const o = v as Record<string, unknown>
  if (typeof o.name !== 'string' || !Array.isArray(o.sections) || o.sections.length === 0) return undefined
  const sections: BakedSection[] = []
  for (const s of o.sections) {
    if (typeof s !== 'object' || s === null) return undefined
    const so = s as Record<string, unknown>
    if (typeof so.code !== 'string' || typeof so.bars !== 'number' || !Number.isFinite(so.bars)) return undefined
    sections.push({ code: so.code, bars: so.bars })
  }
  return { name: o.name, sections }
}

/** Keep only well-formed favorites/descriptors, dedup by seed+index, preserve the baked render, cap the length. */
function sanitizeTrackList(v: unknown): FavoriteTrack[] {
  if (!Array.isArray(v)) return []
  const out: FavoriteTrack[] = []
  const seen = new Set<string>()
  for (const item of v) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    const s = o.style as Record<string, unknown> | undefined
    const ok = typeof o.seed === 'string' && typeof o.index === 'number' && Number.isFinite(o.index)
      && typeof o.mood === 'string' && typeof o.key === 'string' && typeof o.scaleName === 'string'
      && typeof o.bpm === 'number' && Number.isFinite(o.bpm)
      && !!s && typeof s.kick === 'string' && typeof s.bass === 'string' && typeof s.lead === 'string'
      && typeof s.bg === 'string' && typeof s.perc === 'string'
    if (!ok) continue
    const key = `${o.seed as string}:${o.index as number}`
    if (seen.has(key)) continue
    seen.add(key)
    const baked = sanitizeBaked(o.baked)
    out.push({
      seed: o.seed as string, index: o.index as number, mood: o.mood as string, key: o.key as string,
      scaleName: o.scaleName as string, bpm: o.bpm as number,
      style: { kick: s!.kick as string, bass: s!.bass as string, lead: s!.lead as string, bg: s!.bg as string, perc: s!.perc as string },
      ...(baked ? { baked } : {}),
    })
    if (out.length >= RADIO_LIST_CAP) break
  }
  return out
}

// Default volume levels (0..1): effects at full, match and menu music quieter; radio louder (its own mix).
const VOL_DEFAULT = { master: 1, sfx: 1, music: 0.3, menuMusic: 0.3, radio: 0.8 }

/** Coerce volume to valid form: number in [0,1]; missing/garbage → default. */
function clampVolume(v: unknown, dflt: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : dflt
}

/** Coerce to valid form: trim name, colors only from the palette, reserve ≠ primary. */
function sanitize(p: Partial<PlayerProfile>): PlayerProfile {
  const name = (typeof p.name === 'string' ? p.name : '').trim().slice(0, NAME_MAX) || generateModelName()
  const primaryColor = PLAYER_COLORS.includes(p.primaryColor as string) ? (p.primaryColor as string) : PLAYER_COLORS[0]
  let reserveColor = PLAYER_COLORS.includes(p.reserveColor as string) ? (p.reserveColor as string) : PLAYER_COLORS[1]
  if (reserveColor === primaryColor) reserveColor = PLAYER_COLORS.find(c => c !== primaryColor)!
  const defaultView: DefaultView = p.defaultView === 'tp' ? 'tp' : 'fp'   // missing/garbage → fp
  const searchRole: SearchRole = p.searchRole === 'client' ? 'client' : 'both'   // legacy 'host' → 'both'
  const ballModel: BallModel = BALL_MODELS.includes(p.ballModel as BallModel) ? (p.ballModel as BallModel) : 'smooth'
  const windupStyle: WindupStyle = WINDUP_STYLES.includes(p.windupStyle as WindupStyle) ? (p.windupStyle as WindupStyle) : 'classic'
  const respawnStyle: RespawnStyle = RESPAWN_STYLES.includes(p.respawnStyle as RespawnStyle) ? (p.respawnStyle as RespawnStyle) : 'echo'
  const dashStyle: DashStyle = DASH_STYLES.includes(p.dashStyle as DashStyle) ? (p.dashStyle as DashStyle) : 'streak'
  const shieldStyle: ShieldStyle = SHIELD_STYLES.includes(p.shieldStyle as ShieldStyle) ? (p.shieldStyle as ShieldStyle) : 'dome'
  const postProcessing = typeof p.postProcessing === 'boolean' ? p.postProcessing : true   // on by default
  const showFps = typeof p.showFps === 'boolean' ? p.showFps : false       // off by default
  const showSpeed = typeof p.showSpeed === 'boolean' ? p.showSpeed : false  // off by default
  const menuGlow = typeof p.menuGlow === 'boolean' ? p.menuGlow : true       // on by default
  const audioViz = typeof p.audioViz === 'boolean' ? p.audioViz : true       // on by default
  const volumeMaster = clampVolume(p.volumeMaster, VOL_DEFAULT.master)
  const volumeMusic = clampVolume(p.volumeMusic, VOL_DEFAULT.music)
  const volumeSfx = clampVolume(p.volumeSfx, VOL_DEFAULT.sfx)
  const volumeMenuMusic = clampVolume(p.volumeMenuMusic, VOL_DEFAULT.menuMusic)
  const radioEnabled = typeof p.radioEnabled === 'boolean' ? p.radioEnabled : false   // off by default
  const volumeRadio = clampVolume(p.volumeRadio, VOL_DEFAULT.radio)
  const favorites = sanitizeTrackList(p.favorites)
  // connect timeout: only from the allowed options, otherwise default
  const connectTimeoutSec = (CONNECT_TIMEOUT_OPTIONS as readonly number[]).includes(p.connectTimeoutSec as number) ? (p.connectTimeoutSec as number) : CONNECT_TIMEOUT_DEFAULT
  // language: only from registered locales; missing → undefined (user did not choose — detect system)
  const localeIds = LOCALES.map(l => l.id)
  const locale: LocaleId | undefined = localeIds.includes(p.locale as LocaleId) ? (p.locale as LocaleId) : undefined
  // ball artwork: valid base64 string → keep as is; otherwise drop the field (no artwork)
  const ballArt = decodeBallArt(p.ballArt) ? (p.ballArt as string) : undefined
  return { name, primaryColor, reserveColor, defaultView, searchRole, ballModel, windupStyle, respawnStyle, dashStyle, shieldStyle, ballArt, postProcessing, showFps, showSpeed, menuGlow, audioViz, volumeMaster, volumeMusic, volumeSfx, volumeMenuMusic, radioEnabled, volumeRadio, favorites, connectTimeoutSec, locale }
}

/** Load profile. First run (not in localStorage) → create a random one and save it right away. */
export function loadProfile(): PlayerProfile {
  try {
    const raw = lsGet(KEY)
    if (raw) return sanitize(JSON.parse(raw))
  } catch { /* corrupt JSON — recreate */ }
  const fresh = randomProfile()
  saveProfile(fresh)
  return fresh
}

// Optional sink notified after every profile save (e.g. Steam Cloud sync). Kept as a plain
// module hook so settings.ts stays free of any platform/Steam import (DIP); unset in tests.
let profileSaveHook: ((p: PlayerProfile) => void) | null = null
export function setProfileSaveHook(fn: ((p: PlayerProfile) => void) | null): void {
  profileSaveHook = fn
}

export function saveProfile(p: Partial<PlayerProfile>): void {
  const clean = sanitize(p)
  lsSet(KEY, JSON.stringify(clean))
  profileSaveHook?.(clean)
}
