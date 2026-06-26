import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { BloomEffect, EffectPass } from 'postprocessing'
import { HalfFloatType } from 'three'
import * as THREE from 'three'
import type { AudioAnalysis } from '../../game/audio/AudioAnalysis'

/**
 * Radio "takeover": while a track is on the Radio screen the MenuBackdrop becomes a music-reactive visualizer.
 * Three in-scene effects (the Strudel code is a separate DOM panel):
 *   1) a SOFT frosted-glass full-scene Bloom whose intensity ∝ music level (eased in over ~0.2s);
 *   2) a camera dolly (gentle breathing) + per-BEAT punch & shake — the WHEN comes from the rhythm (a low-band
 *      onset), the STRENGTH scales with loudness;
 *   3) stern color-emoji rain IN FRONT of the balls — small, straight down, the per-beat "dash" and base speed
 *      scale with loudness while the beat itself is detected independently of level.
 * Heavy children are memo'd so the postprocessing composer mounts ONCE (re-reconciling it per frame crashes it).
 */

// --- Bloom (frosted-glass) ----------------------------------------------------------------------
const RADIO_BLOOM_FADE_MS = 200
const RADIO_BLOOM_BASE = 0.35
const RADIO_BLOOM_GAIN = 1.4
const RADIO_BLOOM_THRESHOLD = 0.0
const RADIO_BLOOM_SMOOTHING = 0.9
const RADIO_BLOOM_RADIUS = 0.95
const RADIO_BLOOM_LEVEL_GAIN = 1.6
const RADIO_BLOOM_LEVEL_SMOOTH = 0.18

// --- Beat detection (shared scheme) — low-band ENERGY ONSET (flux) + a refractory gap ------------
const RADIO_BANDS = 8
const RADIO_BEAT_FLUX = 0.04          // rise in low-band energy that counts as a kick onset
const RADIO_BEAT_FLOOR = 0.05         // tiny floor — beats register even in quiet parts (only STRENGTH scales)
const RADIO_BEAT_REFRACTORY = 0.11    // min seconds between beats (one kick fires once)
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
const RADIO_CAMERA_PRIORITY = 10      // run AFTER CameraRig (default priority 0)
const RADIO_DOLLY_RANGE = 0.7         // gentle level-based breathing (world units)
const RADIO_DOLLY_TAU = 0.13
const RADIO_CAM_PUNCH_MIN = 0.04      // dolly impulse on a beat in silence
const RADIO_CAM_PUNCH_LEVEL = 0.5     // extra impulse at full level
const RADIO_CAM_PUNCH_DECAY_TAU = 0.09
const RADIO_CAM_SHAKE_MIN = 0.008     // jitter on a beat in silence
const RADIO_CAM_SHAKE_LEVEL = 0.06    // extra jitter at full level
const RADIO_CAM_SHAKE_DECAY_TAU = 0.06

// --- Emoji rain ---------------------------------------------------------------------------------
const RADIO_EMOJI_MAX = 110           // pooled sprite count (kept)
const RADIO_EMOJI_BASE_RATE = 8       // constant trickle (spawns/sec) — they always fall
const RADIO_EMOJI_BURST = 8           // extra emoji spawned ON each beat
const RADIO_EMOJI_FALL_MIN = 0.25     // base fall speed in silence (world u/s)
const RADIO_EMOJI_FALL_LEVEL = 1.3    // extra base fall speed at full level
const RADIO_EMOJI_DASH_MIN = 0.6      // beat dash strength (added to ×1) in silence
const RADIO_EMOJI_DASH_LEVEL = 3.0    // extra dash strength at full level
const RADIO_EMOJI_DASH_TAU_MIN = 0.08 // beat dash DURATION (decay τ) in silence
const RADIO_EMOJI_DASH_TAU_LEVEL = 0.16
const RADIO_EMOJI_SPRITE_PX = 64
const RADIO_EMOJI_FONT_PX = 48
const RADIO_EMOJI_SCALE = 0.12        // small
const RADIO_EMOJI_SPAWN_Y = 4.0
const RADIO_EMOJI_SPAWN_Y_SPREAD = 3.0  // random vertical offset per spawn → no aligned "rows" on a burst
const RADIO_EMOJI_KILL_Y = -3.5
const RADIO_EMOJI_SPREAD_X = 7.0
const RADIO_EMOJI_DEPTH = 3.2         // in front of the camera (sprites also draw over everything)
const RADIO_EMOJI_RENDER_ORDER = 20   // + depthTest:false → always IN FRONT of the balls

// Stern emoji sets (dark arcade-FPS style) — keyed by a substring of the mood id; else the fallback.
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

// Shared scratch — no per-frame allocations.
const _fwd = new THREE.Vector3()
const _bandsCam = new Float32Array(RADIO_BANDS)
const _bandsEmoji = new Float32Array(RADIO_BANDS)

/** Builds a CanvasTexture with the emoji centered on a transparent square. */
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
    // Random X across the field AND a random Y offset so a burst doesn't land all sprites on one row.
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
    // Beat fires independently of loudness; the STRENGTH (dash size + duration) scales with level.
    const beat = detectBeat(_bandsEmoji, prevKick, beatCd, dt)
    if (beat) {
      dashMul.current = 1 + RADIO_EMOJI_DASH_MIN + RADIO_EMOJI_DASH_LEVEL * level
      dashTau.current = RADIO_EMOJI_DASH_TAU_MIN + RADIO_EMOJI_DASH_TAU_LEVEL * level
    }
    dashMul.current += (1 - dashMul.current) * (1 - Math.exp(-dt / dashTau.current))

    // Constant trickle + a burst on the beat (spawn count is level-independent; only motion strength scales).
    spawnAcc.current += RADIO_EMOJI_BASE_RATE * dt
    let toSpawn = Math.floor(spawnAcc.current)
    spawnAcc.current -= toSpawn
    if (beat) toSpawn += RADIO_EMOJI_BURST
    for (let k = 0; k < toSpawn; k++) {
      const free = drops.find(d => !d.active)
      if (!free) break
      spawnOne(free)
    }

    // Base speed scales with loudness; the dash multiplies it. Straight down — no sideways drift.
    const fall = (RADIO_EMOJI_FALL_MIN + RADIO_EMOJI_FALL_LEVEL * level) * dashMul.current
    for (const d of drops) {
      if (!d.active) continue
      d.sprite.position.y -= fall * dt
      if (d.sprite.position.y <= RADIO_EMOJI_KILL_Y) { d.active = false; d.sprite.visible = false }
    }
  })

  return <group ref={groupRef} />
})

/** Camera: gentle level breathing + a per-beat punch & shake (strength ∝ loudness), applied AFTER CameraRig. */
const RadioCameraMod = memo(function RadioCameraMod({ analysis }: { analysis?: AudioAnalysis }) {
  const camera = useThree(s => s.camera)
  const dolly = useRef(0)
  const punch = useRef(0)
  const shake = useRef(0)
  const prevKick = useRef(0)
  const beatCd = useRef(0)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const level = analysis?.level() ?? 0
    analysis?.bands(_bandsCam)
    if (detectBeat(_bandsCam, prevKick, beatCd, dt)) {
      punch.current = RADIO_CAM_PUNCH_MIN + RADIO_CAM_PUNCH_LEVEL * level
      shake.current = RADIO_CAM_SHAKE_MIN + RADIO_CAM_SHAKE_LEVEL * level
    }
    punch.current += (0 - punch.current) * (1 - Math.exp(-dt / RADIO_CAM_PUNCH_DECAY_TAU))
    shake.current += (0 - shake.current) * (1 - Math.exp(-dt / RADIO_CAM_SHAKE_DECAY_TAU))
    dolly.current += (RADIO_DOLLY_RANGE * level - dolly.current) * (1 - Math.exp(-dt / RADIO_DOLLY_TAU))

    camera.getWorldDirection(_fwd)
    camera.position.addScaledVector(_fwd, dolly.current + punch.current)
    if (shake.current > 0) {
      camera.position.x += (Math.random() - 0.5) * 2 * shake.current
      camera.position.y += (Math.random() - 0.5) * 2 * shake.current
      camera.position.z += (Math.random() - 0.5) * 2 * shake.current
    }
  }, RADIO_CAMERA_PRIORITY)

  return null
})

/**
 * Soft frosted-glass Bloom. Built IMPERATIVELY (BloomEffect + EffectPass + <primitive>) like the working
 * MenuEdgeGlow — NOT the <Bloom> wrapper, whose useMemo([JSON.stringify(props)]) re-reconciles the composer on
 * every parent re-render and crashes. memo + stable props → mounts once; intensity set imperatively each frame.
 */
const RadioBloom = memo(function RadioBloom({ analysis, fade }: { analysis?: AudioAnalysis; fade: React.RefObject<number> }) {
  const camera = useThree(s => s.camera)
  const lvl = useRef(0)
  const bloom = useMemo(() => new BloomEffect({
    luminanceThreshold: RADIO_BLOOM_THRESHOLD,
    luminanceSmoothing: RADIO_BLOOM_SMOOTHING,
    mipmapBlur: true,
    radius: RADIO_BLOOM_RADIUS,
    intensity: RADIO_BLOOM_BASE,
  }), [])
  const pass = useMemo(() => new EffectPass(camera, bloom), [camera, bloom])
  useEffect(() => () => { pass.dispose(); bloom.dispose() }, [pass, bloom])

  useFrame(() => {
    const raw = Math.min(1, Math.sqrt((analysis?.level() ?? 0) * RADIO_BLOOM_LEVEL_GAIN))
    lvl.current += (raw - lvl.current) * RADIO_BLOOM_LEVEL_SMOOTH
    bloom.intensity = (RADIO_BLOOM_BASE + RADIO_BLOOM_GAIN * lvl.current) * (fade.current ?? 0)
  })

  return (
    <EffectComposer frameBufferType={HalfFloatType}>
      <primitive object={pass} />
    </EffectComposer>
  )
})

/** The full radio takeover, rendered INSIDE the Canvas only when radioMode is set. */
export function RadioTakeover({ radioMode, analysis }: { radioMode: { mood: string }; analysis?: AudioAnalysis }) {
  const fade = useRef(0)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    fade.current += (1 - fade.current) * (1 - Math.exp(-dt / (RADIO_BLOOM_FADE_MS / 1000)))
  })

  return (
    <>
      <RadioCameraMod analysis={analysis} />
      <EmojiRain analysis={analysis} mood={radioMode.mood} />
      <RadioBloom analysis={analysis} fade={fade} />
    </>
  )
}
