import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { AudioAnalysis } from '../../game/audio/AudioAnalysis'

/**
 * Radio "takeover": while a track is on the Radio screen the MenuBackdrop becomes a music-reactive visualizer.
 * In-scene effects here are the camera and the emoji rain; the soft frosted-glass bloom is part of MenuEdgeGlow
 * (ONE composer — kept mounted so it never recompiles/freezes on radio enter/exit). The Strudel code is a DOM panel.
 * Everything is mounted ONLY while radioMode is set, and ONLY inside the menu backdrop — the in-match camera/visuals
 * are a different Canvas and are never touched by radio.
 */

// --- Beat = a phase-locked TEMPO GRID that gates + quantizes low-band onsets; strength = the hit's loudness. --------
// Post-mortem of what failed before:
//   • fixed flux threshold  → missed soft kicks / fired on noise (no single threshold fits every track)
//   • adaptive baseline     → steady techno's sustained low end raised the baseline until kicks stopped registering
//   • free BPM clock + fill → great TIMING, but invented beats whenever the low end was loud (a bass drone read as a kick)
//   • pure flux onset       → same miss/false problems as the fixed threshold
// The two reliable signals are the TEMPO (known from bpm → WHEN) and the low-band TRANSIENT (flux → IS-a-kick + LOUDNESS).
// A grid ticks at 60/bpm and phase-locks to low-band onsets (PLL) so ticks land ON the kicks. At each tick, strength =
// the recent low-band FLUX peak: a kick is a transient (high flux), a sustained drone / break / silence is not (~0 flux),
// so non-kick ticks are gated out (NO phantom beats) while every on-grid kick fires with strength ∝ its loudness. The
// grid keeps ticking through soft/under-threshold kicks (NO misses); off-grid transients never reach a tick.
const RADIO_BANDS = 8
const RADIO_BEAT_PRIORITY = -1        // run before the camera/emoji frame callbacks (which read the result)
const RADIO_BEAT_MIN_BPM = 60         // guard against a missing/0 bpm
const RADIO_BEAT_ONSET_FLUX = 0.035   // min low-band rise to FIRE (low — off-grid onsets are rejected by the window)
const RADIO_BEAT_PLL_FLUX = 0.09      // a clearer rise that pulls the grid phase toward it (only strong kicks lock phase)
const RADIO_BEAT_PLL_GAIN = 0.2       // how hard each strong onset pulls the grid phase (locks in a few beats)
const RADIO_BEAT_WINDOW_FRAC = 0.26   // an onset counts as a beat only if within interval × this of a grid tick
const RADIO_BEAT_FLUX_FULL = 0.35     // flux that maps to strength 1 (a hard kick) — the reaction scale
const RADIO_BEAT_REFRACTORY_FRAC = 0.4 // min gap between beats = interval × this

// Shared per-frame beat result (one radio screen at a time). fired = a hit happened THIS frame; strength 0..1 = loudness.
const _beat = { fired: false, strength: 0 }
const _bandsBeat = new Float32Array(RADIO_BANDS)
let _phase = 0          // time since the last grid tick
let _sinceBeat = 0      // refractory
let _prevKickBeat = 0

/** Drives `_beat`: fire ON a low-band ONSET when it lands near a bpm-grid tick (the grid quantizes/gates; the PLL
 *  keeps it locked to the kicks). Firing on the onset itself (not on the tick) means a kick is never missed for
 *  arriving a frame after the tick; the grid window rejects off-beat transients; strength = the onset's loudness. */
function BeatClock({ analysis, bpm }: { analysis?: AudioAnalysis; bpm: number }) {
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const interval = 60 / Math.max(RADIO_BEAT_MIN_BPM, bpm)
    analysis?.bands(_bandsBeat)
    const kick = (_bandsBeat[0] ?? 0) + (_bandsBeat[1] ?? 0)
    const flux = Math.max(0, kick - _prevKickBeat)
    _prevKickBeat = kick

    const distToTick = Math.min(_phase, interval - _phase)   // how far NOW is from the nearest grid tick (pre-nudge)
    // Phase-lock: a clear onset pulls the grid phase toward it (gentle → averages noise, locks to the steady kicks).
    if (flux > RADIO_BEAT_PLL_FLUX) {
      let e = _phase
      if (e > interval / 2) e -= interval
      _phase -= e * RADIO_BEAT_PLL_GAIN
    }
    _phase += dt
    if (_phase >= interval) _phase -= interval
    _sinceBeat += dt

    _beat.fired = false
    if (flux > RADIO_BEAT_ONSET_FLUX && distToTick < interval * RADIO_BEAT_WINDOW_FRAC && _sinceBeat > interval * RADIO_BEAT_REFRACTORY_FRAC) {
      _sinceBeat = 0
      _beat.fired = true
      _beat.strength = Math.min(1, flux / RADIO_BEAT_FLUX_FULL)
    }
  }, RADIO_BEAT_PRIORITY)
  return null
}

// --- Camera dolly + per-beat punch & shake (strength ∝ loudness) --------------------------------
// priority 0 (NOT >render): runs after CameraRig (same priority, later subscription) but BEFORE the composer
// render (priority 1). At a higher priority the offset would be applied AFTER the render and overwritten by
// CameraRig before the next one — i.e. never visible. THIS was why the menu camera "didn't react".
const RADIO_CAMERA_PRIORITY = 0
// Camera reacts ONLY to beats with a SMOOTH zoom punch: a beat SETS a target (fast attack), which then "deflates"
// slowly. A new beat re-arms the target (SET, not added) so overlapping beats can't run the zoom to infinity.
const RADIO_CAM_PUNCH_BASE = 0.05    // tiny zoom floor on any hit (world units along the camera forward)
const RADIO_CAM_PUNCH_STRENGTH = 0.32 // zoom scaled by hit loudness (max ≈ 0.37 on a hard kick, ~0 on a faint one)
const RADIO_CAM_ATTACK_TAU = 0.045   // FAST smooth rise on a beat
const RADIO_CAM_DECAY_TAU = 0.22     // deflation (a bit quicker), still slower than the attack
const RADIO_CAM_SHAKE_AMP = 0.006    // shimmer on a beat, scaled by hit loudness
const RADIO_CAM_SHAKE_DECAY_TAU = 0.08

// --- Emoji rain ---------------------------------------------------------------------------------
const RADIO_EMOJI_MAX = 36
// Emoji spawn ONLY on a beat — a batch of 1..2 by beat strength (NO constant trickle) → the beat "births" them.
const RADIO_EMOJI_BURST_MIN = 1
const RADIO_EMOJI_BURST_MAX = 2
const RADIO_EMOJI_FALL_MIN = 0.35     // base fall speed (constant gentle drift)
const RADIO_EMOJI_FALL_LEVEL = 0.4    // small continuous loudness boost
const RADIO_EMOJI_DASH_STRENGTH = 6.0 // fall-speed dash on a hit, scaled by hit loudness (faint hit ⇒ ~no dash)
const RADIO_EMOJI_DASH_TAU = 0.09     // dash DURATION (decay τ) — short = snappy
// On a beat every active emoji gets a synchronized scale pop (eased back) — a clear reaction WITHOUT a jarring teleport.
const RADIO_EMOJI_PULSE_STRENGTH = 1.1 // scale-pop on a hit, scaled by hit loudness (faint hit ⇒ ~no pop)
const RADIO_EMOJI_PULSE_TAU = 0.08    // pop decay τ (snappy)
const RADIO_EMOJI_SPRITE_PX = 64
const RADIO_EMOJI_FONT_PX = 48
const RADIO_EMOJI_SCALE = 0.12
const RADIO_EMOJI_DEPTH = 3.2
const RADIO_EMOJI_RENDER_ORDER = 20
// Per-emoji random spread so they don't all fall in lockstep at one size.
const RADIO_EMOJI_SPEED_VAR = 0.9 // fall-speed multiplier ∈ [1-½var, 1+½var] ≈ 0.55..1.45 (noticeable)
const RADIO_EMOJI_SIZE_VAR = 0.8  // size multiplier ∈ ≈ 0.6..1.4 (noticeable)
// Spawn/kill are computed from the camera's visible rectangle at RADIO_EMOJI_DEPTH (fractions of the half-extents),
// so emoji appear ON-SCREEN at the top THE MOMENT a beat fires (previously they spawned far above view and only
// drifted in seconds later → looked unsynced).
const RADIO_EMOJI_SPAWN_TOP = 1.06    // spawn Y = halfHeight × this — right AT/just above the top edge (enter from
const RADIO_EMOJI_SPAWN_TOP_JIT = 0.12 // off-screen top on the beat, no mid-screen pop-in); ± jitter avoids a "row"
const RADIO_EMOJI_SPREAD_FRAC = 0.9   // horizontal spread = halfWidth × this
const RADIO_EMOJI_KILL_FRAC = 1.08    // kill just below the visible bottom

// Mood → emoji set. Dark/ominous palette (curated with the user). Keys are matched as SUBSTRINGS of the mood
// in THIS order (specific qualifiers before generic) so compound moods land in the right set: e.g. dark_hypnotic
// → occult, dark_ambient → ambient, dub_techno → dub, acid_dark → acid, dark_techno/hard_techno → techno.
const MOOD_EMOJI: Record<string, string[]> = {
  hypnotic:   ['👁️', '🔮', '🕯️', '🧿', '🪬', '🎭', '♟️', '⚱️'],          // dark_hypnotic
  ambient:    ['🌑', '🌚', '🕳️', '🌫️', '🤍', '❄️', '🧊', '🖤'],          // dark_ambient
  acid:       ['☢️', '☣️', '⚠️', '🧬', '🩸', '👁️', '🩻'],                // acid, acid_dark (no syringe — Steam)
  dub:        ['🌑', '🌫️', '🕳️', '🌀', '🤍', '⛓️', '🌊', '🧊'],          // dub_techno
  industrial: ['⚙️', '🔩', '🔗', '⛓️', '🔪', '⚡', '🪦', '🩻', '☠️'],      // industrial
  techno:     ['💀', '⚙️', '🔩', '🔗', '⛓️', '🔪', '⚡', '🩻', '☠️'],      // dark_techno, hard_techno
  dark:       ['💀', '☠️', '🦴', '⚰️', '🪦', '🩸', '🔪', '⛓️', '⚡', '👁️', '🧠'], // dark (generic)
}
const FALLBACK_EMOJI = ['💀', '⚡', '🩻', '⛓️', '🌑', '👁️']
function emojiSetFor(mood: string): string[] {
  const id = mood.toLowerCase()
  for (const key of Object.keys(MOOD_EMOJI)) if (id.includes(key)) return MOOD_EMOJI[key]
  return FALLBACK_EMOJI
}

const _fwd = new THREE.Vector3()

// Bundled emoji font (Twemoji Mozilla — a COLR/CPAL colour font Chromium renders into a canvas) so the rain looks
// identical on every OS instead of leaning on the system emoji font. Loaded once at module init; textures created
// before it's ready draw with the serif fallback and are re-drawn in place when the font arrives (see below).
const RADIO_EMOJI_FONT_FAMILY = 'Twemoji Mozilla'
const RADIO_EMOJI_FONT_URL = '/fonts/Twemoji.Mozilla.ttf'
const RADIO_EMOJI_FONT = `${RADIO_EMOJI_FONT_PX}px "${RADIO_EMOJI_FONT_FAMILY}", serif`
const emojiFontReady: Promise<void> =
  (typeof FontFace !== 'undefined' && typeof document !== 'undefined' && 'fonts' in document)
    ? new FontFace(RADIO_EMOJI_FONT_FAMILY, `url(${RADIO_EMOJI_FONT_URL})`).load()
        .then(face => { document.fonts.add(face) }).catch(() => { /* fall back to system emoji */ })
    : Promise.resolve()

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string): void {
  ctx.clearRect(0, 0, RADIO_EMOJI_SPRITE_PX, RADIO_EMOJI_SPRITE_PX)
  ctx.font = RADIO_EMOJI_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, RADIO_EMOJI_SPRITE_PX / 2, RADIO_EMOJI_SPRITE_PX / 2)
}

function makeEmojiTexture(emoji: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = RADIO_EMOJI_SPRITE_PX
  canvas.height = RADIO_EMOJI_SPRITE_PX
  const ctx = canvas.getContext('2d')!
  const tex = new THREE.CanvasTexture(canvas)
  drawEmoji(ctx, emoji)                                    // draw now (system fallback if the font isn't ready yet)
  tex.needsUpdate = true
  void emojiFontReady.then(() => { drawEmoji(ctx, emoji); tex.needsUpdate = true })  // upgrade to Twemoji in place
  return tex
}

interface Drop { sprite: THREE.Sprite; active: boolean; speed: number; size: number }

const EmojiRain = memo(function EmojiRain({ analysis, mood }: { analysis?: AudioAnalysis; mood: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const camera = useThree(s => s.camera)
  const dashMul = useRef(1)
  const pulse = useRef(1)
  const texCache = useRef<Map<string, THREE.CanvasTexture>>(new Map())
  const set = emojiSetFor(mood)

  // Pool created ONCE (NOT keyed by mood) → switching tracks doesn't despawn the falling emoji.
  const drops = useMemo(() => {
    const pool: Drop[] = []
    for (let i = 0; i < RADIO_EMOJI_MAX; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.setScalar(RADIO_EMOJI_SCALE)
      // Unique renderOrder per sprite → a stable transparency draw order. With depthTest off and EQUAL camera
      // distance (all at z=0), a shared renderOrder made the sort flicker when two overlapped.
      sprite.renderOrder = RADIO_EMOJI_RENDER_ORDER + i
      sprite.visible = false
      pool.push({ sprite, active: false, speed: 1, size: 1 })
    }
    return pool
  }, [])

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    const cache = texCache.current
    for (const d of drops) g.add(d.sprite)
    return () => {
      for (const d of drops) { g.remove(d.sprite); (d.sprite.material as THREE.SpriteMaterial).dispose() }
      for (const t of cache.values()) t.dispose()
      cache.clear()
    }
  }, [drops])

  const texFor = (glyph: string): THREE.CanvasTexture => {
    let t = texCache.current.get(glyph)
    if (!t) { t = makeEmojiTexture(glyph); texCache.current.set(glyph, t) }
    return t
  }
  const spawnOne = (free: Drop, halfW: number, halfH: number) => {
    const mat = free.sprite.material as THREE.SpriteMaterial
    mat.map = texFor(set[Math.floor(Math.random() * set.length)])
    mat.needsUpdate = true
    free.active = true
    free.speed = 1 + (Math.random() - 0.5) * RADIO_EMOJI_SPEED_VAR
    free.size = 1 + (Math.random() - 0.5) * RADIO_EMOJI_SIZE_VAR
    free.sprite.visible = true
    free.sprite.position.set(
      (Math.random() - 0.5) * 2 * halfW * RADIO_EMOJI_SPREAD_FRAC,
      halfH * (RADIO_EMOJI_SPAWN_TOP + (Math.random() - 0.5) * 2 * RADIO_EMOJI_SPAWN_TOP_JIT),
      0,
    )
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const g = groupRef.current
    if (!g) return
    camera.getWorldDirection(_fwd)
    g.position.copy(camera.position).addScaledVector(_fwd, RADIO_EMOJI_DEPTH)
    g.quaternion.copy(camera.quaternion)

    // Visible half-extents at the emoji plane → spawn on-screen at the top, kill just past the bottom.
    const cam = camera as THREE.PerspectiveCamera
    const halfH = RADIO_EMOJI_DEPTH * Math.tan((cam.fov * Math.PI / 180) / 2)
    const halfW = halfH * cam.aspect
    const killY = -halfH * RADIO_EMOJI_KILL_FRAC

    const level = analysis?.level() ?? 0
    const strength = _beat.strength   // = the rhythm hit's loudness (flux) → all reactions scale with it
    if (_beat.fired) {
      dashMul.current = 1 + RADIO_EMOJI_DASH_STRENGTH * strength
      pulse.current = 1 + RADIO_EMOJI_PULSE_STRENGTH * strength
      // Spawn a BATCH by hit loudness — emoji appear only on a beat (the beat "births" them).
      const batch = RADIO_EMOJI_BURST_MIN + Math.round((RADIO_EMOJI_BURST_MAX - RADIO_EMOJI_BURST_MIN) * strength)
      for (let k = 0; k < batch; k++) {
        const free = drops.find(d => !d.active)
        if (!free) break
        spawnOne(free, halfW, halfH)
      }
    }
    dashMul.current += (1 - dashMul.current) * (1 - Math.exp(-dt / RADIO_EMOJI_DASH_TAU))
    pulse.current += (1 - pulse.current) * (1 - Math.exp(-dt / RADIO_EMOJI_PULSE_TAU))

    const fall = (RADIO_EMOJI_FALL_MIN + RADIO_EMOJI_FALL_LEVEL * level) * dashMul.current
    const scale = RADIO_EMOJI_SCALE * pulse.current
    for (const d of drops) {
      if (!d.active) continue
      d.sprite.scale.setScalar(scale * d.size)       // per-emoji size spread
      d.sprite.position.y -= fall * d.speed * dt      // per-emoji fall-speed spread
      if (d.sprite.position.y <= killY) { d.active = false; d.sprite.visible = false }
    }
  })

  return <group ref={groupRef} />
})

/** Camera: a SMOOTH per-beat zoom punch (fast attack, slow deflate, re-armable without runaway) + a faint shake.
 *  Beats only — no continuous breathing. Applied right after CameraRig (priority 0, before the composer render). */
const RadioCameraMod = memo(function RadioCameraMod() {
  const camera = useThree(s => s.camera)
  const target = useRef(0)   // zoom target — SET on a beat, decays slowly (the "deflation")
  const punch = useRef(0)    // actual zoom — chases the target with a fast attack (smooth)
  const shake = useRef(0)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    if (_beat.fired) {   // shared beat — the camera and the emoji react on the SAME frame; strength = hit loudness
      target.current = RADIO_CAM_PUNCH_BASE + RADIO_CAM_PUNCH_STRENGTH * _beat.strength   // SET (re-armable, never accumulates)
      shake.current = RADIO_CAM_SHAKE_AMP * _beat.strength
    }
    target.current += (0 - target.current) * (1 - Math.exp(-dt / RADIO_CAM_DECAY_TAU))   // slow deflation
    punch.current += (target.current - punch.current) * (1 - Math.exp(-dt / RADIO_CAM_ATTACK_TAU))   // fast smooth rise
    shake.current += (0 - shake.current) * (1 - Math.exp(-dt / RADIO_CAM_SHAKE_DECAY_TAU))

    camera.getWorldDirection(_fwd)
    camera.position.addScaledVector(_fwd, punch.current)
    if (shake.current > 0) {
      camera.position.x += (Math.random() - 0.5) * 2 * shake.current
      camera.position.y += (Math.random() - 0.5) * 2 * shake.current
      camera.position.z += (Math.random() - 0.5) * 2 * shake.current
    }
  }, RADIO_CAMERA_PRIORITY)

  return null
})

/** The full radio takeover (camera + emoji), rendered INSIDE the menu Canvas only when radioMode is set.
 *  BeatClock runs first (priority −1) and drives the shared `_beat` from the low-band onset flux. */
export function RadioTakeover({ radioMode, analysis }: { radioMode: { mood: string; bpm: number }; analysis?: AudioAnalysis }) {
  return (
    <>
      <BeatClock analysis={analysis} bpm={radioMode.bpm} />
      <RadioCameraMod />
      <EmojiRain analysis={analysis} mood={radioMode.mood} />
    </>
  )
}
