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

// --- Beat detection (shared) — low-band ENERGY ONSET (flux) + a refractory gap -------------------
const RADIO_BANDS = 8
const RADIO_BEAT_FLUX = 0.09          // rise in low-band energy that counts as a kick onset (strict → only real kicks)
const RADIO_BEAT_FLOOR = 0.25         // the low band must be genuinely loud — ignores reverb tails / quiet noise (no OUTRO false hits)
const RADIO_BEAT_REFRACTORY = 0.13    // min seconds between beats
/** Kick energy = the two lowest bands. Returns whether a fresh beat fired this frame. */
function detectBeat(bands: Float32Array, prev: { current: number }, cd: { current: number }, dt: number): boolean {
  const kick = (bands[0] ?? 0) + (bands[1] ?? 0)
  const flux = kick - prev.current
  prev.current = kick
  cd.current -= dt
  if (flux > RADIO_BEAT_FLUX && kick > RADIO_BEAT_FLOOR && cd.current <= 0) { cd.current = RADIO_BEAT_REFRACTORY; return true }
  return false
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
const RADIO_CAM_DECAY_TAU = 0.35     // slower deflation
const RADIO_CAM_SHAKE_AMP = 0.005    // a barely-perceptible shimmer on a beat
const RADIO_CAM_SHAKE_DECAY_TAU = 0.08

// --- Emoji rain ---------------------------------------------------------------------------------
const RADIO_EMOJI_MAX = 110
const RADIO_EMOJI_BASE_RATE = 8       // constant trickle (spawns/sec) — they always fall
const RADIO_EMOJI_BURST = 8           // extra emoji spawned ON each beat
const RADIO_EMOJI_FALL_MIN = 0.25     // base fall speed in silence
const RADIO_EMOJI_FALL_LEVEL = 1.3    // extra base fall speed at full level
const RADIO_EMOJI_DASH_MIN = 0.6      // beat dash strength (added to ×1) in silence
const RADIO_EMOJI_DASH_LEVEL = 3.0    // extra dash strength at full level
const RADIO_EMOJI_DASH_TAU_MIN = 0.08 // dash DURATION (decay τ) in silence
const RADIO_EMOJI_DASH_TAU_LEVEL = 0.16
const RADIO_EMOJI_SPRITE_PX = 64
const RADIO_EMOJI_FONT_PX = 48
const RADIO_EMOJI_SCALE = 0.12
const RADIO_EMOJI_SPAWN_Y = 4.0
const RADIO_EMOJI_SPAWN_Y_SPREAD = 3.0
const RADIO_EMOJI_KILL_Y = -3.5
const RADIO_EMOJI_SPREAD_X = 7.0
const RADIO_EMOJI_DEPTH = 3.2
const RADIO_EMOJI_RENDER_ORDER = 20

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
const _bandsCam = new Float32Array(RADIO_BANDS)
const _bandsEmoji = new Float32Array(RADIO_BANDS)

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
  const spawnAcc = useRef(0)
  const dashMul = useRef(1)
  const dashTau = useRef(RADIO_EMOJI_DASH_TAU_MIN)
  const prevKick = useRef(0)
  const beatCd = useRef(0)
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
  const spawnOne = (free: Drop) => {
    const mat = free.sprite.material as THREE.SpriteMaterial
    mat.map = texFor(set[Math.floor(Math.random() * set.length)])
    mat.needsUpdate = true
    free.active = true
    free.sprite.visible = true
    free.sprite.position.set(
      (Math.random() - 0.5) * RADIO_EMOJI_SPREAD_X,
      RADIO_EMOJI_SPAWN_Y + Math.random() * RADIO_EMOJI_SPAWN_Y_SPREAD,
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

    const level = analysis?.level() ?? 0
    analysis?.bands(_bandsEmoji)
    const beat = detectBeat(_bandsEmoji, prevKick, beatCd, dt)
    if (beat) {
      dashMul.current = 1 + RADIO_EMOJI_DASH_MIN + RADIO_EMOJI_DASH_LEVEL * level
      dashTau.current = RADIO_EMOJI_DASH_TAU_MIN + RADIO_EMOJI_DASH_TAU_LEVEL * level
    }
    dashMul.current += (1 - dashMul.current) * (1 - Math.exp(-dt / dashTau.current))

    spawnAcc.current += RADIO_EMOJI_BASE_RATE * dt
    let toSpawn = Math.floor(spawnAcc.current)
    spawnAcc.current -= toSpawn
    if (beat) toSpawn += RADIO_EMOJI_BURST
    for (let k = 0; k < toSpawn; k++) {
      const free = drops.find(d => !d.active)
      if (!free) break
      spawnOne(free)
    }

    const fall = (RADIO_EMOJI_FALL_MIN + RADIO_EMOJI_FALL_LEVEL * level) * dashMul.current
    for (const d of drops) {
      if (!d.active) continue
      d.sprite.position.y -= fall * dt
      if (d.sprite.position.y <= RADIO_EMOJI_KILL_Y) { d.active = false; d.sprite.visible = false }
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
  const prevKick = useRef(0)
  const beatCd = useRef(0)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const level = analysis?.level() ?? 0
    analysis?.bands(_bandsCam)
    if (detectBeat(_bandsCam, prevKick, beatCd, dt)) {
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

/** The full radio takeover (camera + emoji), rendered INSIDE the menu Canvas only when radioMode is set. */
export function RadioTakeover({ radioMode, analysis }: { radioMode: { mood: string }; analysis?: AudioAnalysis }) {
  return (
    <>
      <RadioCameraMod analysis={analysis} />
      <EmojiRain analysis={analysis} mood={radioMode.mood} />
    </>
  )
}
