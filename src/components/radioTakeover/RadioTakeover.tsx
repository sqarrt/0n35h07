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

// --- Beat = a low-band ONSET, with reaction STRENGTH ∝ the rhythm hit's loudness. The mixed low band can't tell the
// kick from the sustained bass by absolute energy — but a kick is a TRANSIENT, so the FLUX (frame-to-frame rise of the
// low band) is the rhythm hit and its size is the hit's loudness. Driving everything by flux means: loud kick → strong
// reaction; soft kick → faint; sustained bass / quiet / a stray trigger → ~0 flux → ~0 reaction (no phantom beats).
// No tempo prediction (a predicted beat on sustained energy was the phantom-beat source). ONE shared result.
const RADIO_BANDS = 8
const RADIO_BEAT_PRIORITY = -1       // run before the camera/emoji frame callbacks (which read the result)
const RADIO_BEAT_ONSET_FLUX = 0.08   // min low-band rise to count as a rhythm hit (anti-noise trigger)
const RADIO_BEAT_ENERGY_FLOOR = 0.12 // need some low-band energy present (no triggers in near-silence)
const RADIO_BEAT_FLUX_FULL = 0.45    // flux that maps to strength 1 (a hard kick) — the reaction scale
const RADIO_BEAT_REFRACTORY = 0.09   // min seconds between hits (one kick fires once)

// Shared per-frame beat result (one radio screen at a time). fired = a hit happened THIS frame; strength 0..1 = loudness.
const _beat = { fired: false, strength: 0 }
const _bandsBeat = new Float32Array(RADIO_BANDS)
let _sinceBeat = 0      // time since the last fired hit (refractory)
let _prevKickBeat = 0

/** Drives the shared `_beat` each frame from low-band onset flux; strength = the hit's loudness (flux magnitude). */
function BeatClock({ analysis }: { analysis?: AudioAnalysis }) {
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    analysis?.bands(_bandsBeat)
    const kick = (_bandsBeat[0] ?? 0) + (_bandsBeat[1] ?? 0)
    const flux = kick - _prevKickBeat
    _prevKickBeat = kick
    _sinceBeat += dt
    _beat.fired = false
    if (flux > RADIO_BEAT_ONSET_FLUX && kick > RADIO_BEAT_ENERGY_FLOOR && _sinceBeat > RADIO_BEAT_REFRACTORY) {
      _sinceBeat = 0
      _beat.fired = true
      _beat.strength = Math.min(1, flux / RADIO_BEAT_FLUX_FULL)   // reaction strength = how loud the hit was
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
const RADIO_CAM_PUNCH_STRENGTH = 0.55 // zoom scaled by hit loudness (max ≈ 0.6 on a hard kick, ~0 on a faint one)
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
      d.sprite.scale.setScalar(scale)
      d.sprite.position.y -= fall * dt
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
      <BeatClock analysis={analysis} />
      <RadioCameraMod />
      <EmojiRain analysis={analysis} mood={radioMode.mood} />
    </>
  )
}
