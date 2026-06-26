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

// --- Beat = a BPM CLOCK (the radio is generative → the tempo is KNOWN). Pure audio detection on the mixed low band
// fails (the kick can't be told apart from the sustained bass → it either misses kicks or fires off-beat). Instead
// we run a clock at the track's kick rate (60/bpm s), realign its phase to real low-band ONSETS, and gate it by
// energy (so breaks/silence don't pulse). ONE shared result → the camera and the emoji react on the SAME beat.
const RADIO_BANDS = 8
const RADIO_BEAT_PRIORITY = -1       // run before the camera/emoji frame callbacks (which read the result)
const RADIO_BEAT_MIN_BPM = 60        // guard against a missing/0 bpm
const RADIO_BEAT_ONSET_FLUX = 0.1    // a clear low-band transient → fire now + realign the clock phase
const RADIO_BEAT_ENERGY_FLOOR = 0.08 // clock-filled beats need some kick energy (skip breaks / outros)
const RADIO_BEAT_FULL_ENERGY = 1.2   // kick energy that maps to strength 1 (band0+band1, each 0..1)
const RADIO_BEAT_MIN_GAP_FRAC = 0.45 // min gap between beats = interval × this (no double-fire from onset+clock)

// Shared per-frame beat result (one radio screen at a time). fired = a beat happened THIS frame; strength 0..1.
const _beat = { fired: false, strength: 0 }
const _bandsBeat = new Float32Array(RADIO_BANDS)
let _phase = 0          // time since the last grid tick
let _sinceBeat = 0      // time since the last fired beat (refractory)
let _prevKickBeat = 0

/** Drives the shared `_beat` each frame from a BPM clock + onset realignment + energy gate. */
function BeatClock({ analysis, bpm }: { analysis?: AudioAnalysis; bpm: number }) {
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    analysis?.bands(_bandsBeat)
    const kick = (_bandsBeat[0] ?? 0) + (_bandsBeat[1] ?? 0)
    const flux = kick - _prevKickBeat
    _prevKickBeat = kick
    const interval = 60 / Math.max(RADIO_BEAT_MIN_BPM, bpm)
    _phase += dt
    _sinceBeat += dt
    _beat.fired = false
    const strength = Math.min(1, kick / RADIO_BEAT_FULL_ENERGY)
    const canFire = _sinceBeat > interval * RADIO_BEAT_MIN_GAP_FRAC
    if (flux > RADIO_BEAT_ONSET_FLUX && canFire) {
      // a real kick arrived → fire and snap the clock to it
      _phase = 0; _sinceBeat = 0; _beat.fired = true; _beat.strength = strength
    } else if (_phase >= interval) {
      _phase -= interval
      if (kick > RADIO_BEAT_ENERGY_FLOOR && canFire) { _sinceBeat = 0; _beat.fired = true; _beat.strength = strength }
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
const RADIO_CAM_PUNCH_BASE = 0.15    // beat zoom in silence (world units along the camera forward)
const RADIO_CAM_PUNCH_LEVEL = 0.25   // extra zoom at the music peak (max ≈ 0.4 — subtle)
const RADIO_CAM_ATTACK_TAU = 0.045   // FAST smooth rise on a beat
const RADIO_CAM_DECAY_TAU = 0.22     // deflation (a bit quicker), still slower than the attack
const RADIO_CAM_SHAKE_AMP = 0.005    // a barely-perceptible shimmer on a beat
const RADIO_CAM_SHAKE_DECAY_TAU = 0.08

// --- Emoji rain ---------------------------------------------------------------------------------
const RADIO_EMOJI_MAX = 130
// Emoji spawn ONLY on a beat — a batch of 2..5 by beat strength (NO constant trickle) → the beat "births" them.
const RADIO_EMOJI_BURST_MIN = 2
const RADIO_EMOJI_BURST_MAX = 5
const RADIO_EMOJI_FALL_MIN = 0.35     // base fall speed (the BEAT dash drives the motion)
const RADIO_EMOJI_FALL_LEVEL = 0.4    // small continuous loudness boost
const RADIO_EMOJI_DASH_MIN = 0.8      // beat dash floor (already snappy at quiet)
const RADIO_EMOJI_DASH_LEVEL = 9.0    // strong loudness-scaled dash — already-falling emoji jolt hard on a beat
const RADIO_EMOJI_DASH_TAU_MIN = 0.07 // dash DURATION (decay τ) — short = snappy
const RADIO_EMOJI_DASH_TAU_LEVEL = 0.12
const RADIO_EMOJI_SPRITE_PX = 64
const RADIO_EMOJI_FONT_PX = 48
const RADIO_EMOJI_SCALE = 0.12
const RADIO_EMOJI_DEPTH = 3.2
const RADIO_EMOJI_RENDER_ORDER = 20
// Spawn/kill are computed from the camera's visible rectangle at RADIO_EMOJI_DEPTH (fractions of the half-extents),
// so emoji appear ON-SCREEN at the top THE MOMENT a beat fires (previously they spawned far above view and only
// drifted in seconds later → looked unsynced).
const RADIO_EMOJI_SPAWN_TOP = 1.06    // spawn Y = halfHeight × this — right AT/just above the top edge (enter from
const RADIO_EMOJI_SPAWN_TOP_JIT = 0.12 // off-screen top on the beat, no mid-screen pop-in); ± jitter avoids a "row"
const RADIO_EMOJI_SPREAD_FRAC = 0.9   // horizontal spread = halfWidth × this
const RADIO_EMOJI_KILL_FRAC = 1.08    // kill just below the visible bottom

const MOOD_EMOJI: Record<string, string[]> = {
  dark:   ['💀', '🔥', '⚡', '🩸', '🕸️', '☠️'],
  techno: ['💀', '⚙️', '⚡', '🔩', '🕸️', '🔥'],
  dub:    ['🌫️', '🕳️', '🩶', '⛓️', '🌑'],
  deep:   ['🌑', '🕳️', '🩶', '🌫️', '⛓️'],
  acid:   ['☢️', '🧪', '⚗️', '👁️', '🦠'],
}
const FALLBACK_EMOJI = ['💀', '⚡', '🔥', '🩻', '⛓️', '🕷️']
function emojiSetFor(mood: string): string[] {
  const id = mood.toLowerCase()
  for (const key of Object.keys(MOOD_EMOJI)) if (id.includes(key)) return MOOD_EMOJI[key]
  return FALLBACK_EMOJI
}

const _fwd = new THREE.Vector3()

function makeEmojiTexture(emoji: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = RADIO_EMOJI_SPRITE_PX
  canvas.height = RADIO_EMOJI_SPRITE_PX
  const ctx = canvas.getContext('2d')!
  ctx.font = `${RADIO_EMOJI_FONT_PX}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, RADIO_EMOJI_SPRITE_PX / 2, RADIO_EMOJI_SPRITE_PX / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

interface Drop { sprite: THREE.Sprite; active: boolean }

const EmojiRain = memo(function EmojiRain({ analysis, mood }: { analysis?: AudioAnalysis; mood: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const camera = useThree(s => s.camera)
  const dashMul = useRef(1)
  const dashTau = useRef(RADIO_EMOJI_DASH_TAU_MIN)
  const texCache = useRef<Map<string, THREE.CanvasTexture>>(new Map())
  const set = emojiSetFor(mood)

  // Pool created ONCE (NOT keyed by mood) → switching tracks doesn't despawn the falling emoji.
  const drops = useMemo(() => {
    const pool: Drop[] = []
    for (let i = 0; i < RADIO_EMOJI_MAX; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.setScalar(RADIO_EMOJI_SCALE)
      sprite.renderOrder = RADIO_EMOJI_RENDER_ORDER
      sprite.visible = false
      pool.push({ sprite, active: false })
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
    const strength = _beat.strength
    if (_beat.fired) {
      // Dash strength scales with loudness AND the beat strength.
      dashMul.current = 1 + (RADIO_EMOJI_DASH_MIN + RADIO_EMOJI_DASH_LEVEL * level) * strength
      dashTau.current = RADIO_EMOJI_DASH_TAU_MIN + RADIO_EMOJI_DASH_TAU_LEVEL * level
      // Spawn a BATCH of 2..5 by beat strength — emoji appear only on a beat (the beat "births" them).
      const batch = RADIO_EMOJI_BURST_MIN + Math.round((RADIO_EMOJI_BURST_MAX - RADIO_EMOJI_BURST_MIN) * strength)
      for (let k = 0; k < batch; k++) {
        const free = drops.find(d => !d.active)
        if (!free) break
        spawnOne(free, halfW, halfH)
      }
    }
    dashMul.current += (1 - dashMul.current) * (1 - Math.exp(-dt / dashTau.current))

    const fall = (RADIO_EMOJI_FALL_MIN + RADIO_EMOJI_FALL_LEVEL * level) * dashMul.current
    for (const d of drops) {
      if (!d.active) continue
      d.sprite.position.y -= fall * dt
      if (d.sprite.position.y <= killY) { d.active = false; d.sprite.visible = false }
    }
  })

  return <group ref={groupRef} />
})

/** Camera: a SMOOTH per-beat zoom punch (fast attack, slow deflate, re-armable without runaway) + a faint shake.
 *  Beats only — no continuous breathing. Applied right after CameraRig (priority 0, before the composer render). */
const RadioCameraMod = memo(function RadioCameraMod({ analysis }: { analysis?: AudioAnalysis }) {
  const camera = useThree(s => s.camera)
  const target = useRef(0)   // zoom target — SET on a beat, decays slowly (the "deflation")
  const punch = useRef(0)    // actual zoom — chases the target with a fast attack (smooth)
  const shake = useRef(0)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const level = analysis?.level() ?? 0
    if (_beat.fired) {   // shared beat — the camera and the emoji react on the SAME frame
      target.current = RADIO_CAM_PUNCH_BASE + RADIO_CAM_PUNCH_LEVEL * level   // SET (re-armable, never accumulates)
      shake.current = RADIO_CAM_SHAKE_AMP
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
 *  BeatClock runs first (priority −1) and drives the shared `_beat` from the track's known tempo. */
export function RadioTakeover({ radioMode, analysis }: { radioMode: { mood: string; bpm: number }; analysis?: AudioAnalysis }) {
  return (
    <>
      <BeatClock analysis={analysis} bpm={radioMode.bpm} />
      <RadioCameraMod analysis={analysis} />
      <EmojiRain analysis={analysis} mood={radioMode.mood} />
    </>
  )
}
