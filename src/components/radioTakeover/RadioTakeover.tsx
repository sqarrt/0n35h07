import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { BloomEffect, EffectPass } from 'postprocessing'
import { HalfFloatType } from 'three'
import * as THREE from 'three'
import type { AudioAnalysis } from '../../game/audio/AudioAnalysis'

/**
 * Radio "takeover": when the Radio screen is active, the MenuBackdrop becomes a music-reactive visualizer.
 * Three in-scene effects (the Strudel code lives in a DOM glass panel, not here):
 *   1) a SOFT frosted-glass full-scene Bloom whose intensity ∝ music level (eased in over ~0.2s);
 *   2) a camera dolly (breathing) + beat-shake, applied additively AFTER CameraRig;
 *   3) stern color-emoji rain IN FRONT of the balls — small & dense, driven by the RHYTHM (a low-band beat
 *      bursts a batch and dashes them down), NOT by the overall loudness.
 * The normal menu (radioMode === undefined) never mounts any of this. Heavy children are memo'd so the
 * EffectComposer mounts ONCE (re-reconciling the postprocessing composer per frame crashes it).
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

// --- Camera dolly + shake -----------------------------------------------------------------------
const RADIO_CAMERA_PRIORITY = 10
const RADIO_DOLLY_RANGE = 1.2
const RADIO_DOLLY_TAU = 0.12
const RADIO_SHAKE_THRESHOLD = 0.6
const RADIO_SHAKE_AMP = 0.06
const RADIO_SHAKE_DECAY_TAU = 0.06
const RADIO_SHAKE_BAND = 7
const RADIO_BANDS = 8

// --- Emoji rain (rhythm-driven, NOT loudness-driven) --------------------------------------------
const RADIO_EMOJI_MAX = 110              // pooled sprite count (small & dense)
const RADIO_EMOJI_BASE_RATE = 10         // constant trickle (spawns/sec) — they always fall, regardless of level
const RADIO_EMOJI_BURST = 8              // extra emoji spawned ON each beat
const RADIO_EMOJI_FALL_SPEED = 1.6       // constant fall speed (world u/s) — independent of loudness
const RADIO_EMOJI_DASH_MUL = 3.5         // fall-speed multiplier on a fresh beat (the rain "dashes" on the kick)
const RADIO_EMOJI_DASH_DECAY_TAU = 0.16  // dash multiplier eases back to 1
const RADIO_EMOJI_BEAT_BAND = 1          // low band ≈ kick/bass — the beat we listen to
const RADIO_EMOJI_BEAT_THRESHOLD = 0.42  // rising-edge magnitude that counts as a beat
const RADIO_EMOJI_SPRITE_PX = 64
const RADIO_EMOJI_FONT_PX = 48
const RADIO_EMOJI_SCALE = 0.28           // sprite world size (half the old size → twice as many read on screen)
const RADIO_EMOJI_SPAWN_Y = 4.0
const RADIO_EMOJI_KILL_Y = -3.5
const RADIO_EMOJI_SPREAD_X = 7.0
const RADIO_EMOJI_DEPTH = 3.2            // in front of the camera (sprites also draw over everything)
const RADIO_EMOJI_RENDER_ORDER = 20      // + depthTest:false → always IN FRONT of the balls
const RADIO_EMOJI_DRIFT = 0.3

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
const _bands = new Float32Array(RADIO_BANDS)
const _bandsEmoji = new Float32Array(RADIO_BANDS)

/** Builds (and caches per glyph) a CanvasTexture with the emoji centered on a transparent square. */
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

interface Drop { sprite: THREE.Sprite; active: boolean; vx: number }

/**
 * Stern color-emoji rain IN FRONT of the balls (depthTest off + high renderOrder). Sprites are pooled/recycled.
 * They fall at a CONSTANT speed (loudness-independent); a low-band (kick) beat bursts a batch in and spikes a
 * shared dash multiplier, so the rain pulses with the rhythm.
 */
const EmojiRain = memo(function EmojiRain({ analysis, mood }: { analysis?: AudioAnalysis; mood: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const camera = useThree(s => s.camera)
  const spawnAcc = useRef(0)
  const dashMul = useRef(1)
  const prevKick = useRef(0)

  const { textures, drops } = useMemo(() => {
    const set = emojiSetFor(mood)
    const texList = set.map(makeEmojiTexture)
    const pool: Drop[] = []
    for (let i = 0; i < RADIO_EMOJI_MAX; i++) {
      const mat = new THREE.SpriteMaterial({ map: texList[i % texList.length], transparent: true, depthWrite: false, depthTest: false })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.setScalar(RADIO_EMOJI_SCALE)
      sprite.renderOrder = RADIO_EMOJI_RENDER_ORDER
      sprite.visible = false
      pool.push({ sprite, active: false, vx: 0 })
    }
    return { textures: texList, drops: pool }
  }, [mood])

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    for (const d of drops) g.add(d.sprite)
    return () => {
      for (const d of drops) { g.remove(d.sprite); (d.sprite.material as THREE.SpriteMaterial).dispose() }
      for (const t of textures) t.dispose()
    }
  }, [drops, textures])

  const spawnOne = (free: Drop) => {
    free.active = true
    free.sprite.visible = true
    free.sprite.position.set((Math.random() - 0.5) * RADIO_EMOJI_SPREAD_X, RADIO_EMOJI_SPAWN_Y, 0)
    free.vx = (Math.random() - 0.5) * 2 * RADIO_EMOJI_DRIFT
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const g = groupRef.current
    if (!g) return
    camera.getWorldDirection(_fwd)
    g.position.copy(camera.position).addScaledVector(_fwd, RADIO_EMOJI_DEPTH)
    g.quaternion.copy(camera.quaternion)

    // Beat = a rising edge in the low (kick) band — drives bursts + the dash. NOT the overall level.
    analysis?.bands(_bandsEmoji)
    const kick = _bandsEmoji[RADIO_EMOJI_BEAT_BAND] ?? 0
    const beat = kick >= RADIO_EMOJI_BEAT_THRESHOLD && prevKick.current < RADIO_EMOJI_BEAT_THRESHOLD
    prevKick.current = kick
    if (beat) dashMul.current = RADIO_EMOJI_DASH_MUL
    dashMul.current += (1 - dashMul.current) * (1 - Math.exp(-dt / RADIO_EMOJI_DASH_DECAY_TAU))

    // Constant trickle + a burst on the beat.
    spawnAcc.current += RADIO_EMOJI_BASE_RATE * dt
    let toSpawn = Math.floor(spawnAcc.current)
    spawnAcc.current -= toSpawn
    if (beat) toSpawn += RADIO_EMOJI_BURST
    for (let k = 0; k < toSpawn; k++) {
      const free = drops.find(d => !d.active)
      if (!free) break
      spawnOne(free)
    }

    const fall = RADIO_EMOJI_FALL_SPEED * dashMul.current
    for (const d of drops) {
      if (!d.active) continue
      d.sprite.position.y -= fall * dt
      d.sprite.position.x += d.vx * dt
      if (d.sprite.position.y <= RADIO_EMOJI_KILL_Y) { d.active = false; d.sprite.visible = false }
    }
  })

  return <group ref={groupRef} />
})

/** Camera dolly + beat-shake, applied AFTER CameraRig as an additive offset (returns to 0 on unmount). */
const RadioCameraMod = memo(function RadioCameraMod({ analysis }: { analysis?: AudioAnalysis }) {
  const camera = useThree(s => s.camera)
  const dolly = useRef(0)
  const shake = useRef(0)
  const prevHit = useRef(false)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const level = analysis?.level() ?? 0
    analysis?.bands(_bands)
    const hi = _bands[RADIO_SHAKE_BAND] ?? 0

    dolly.current += (RADIO_DOLLY_RANGE * level - dolly.current) * (1 - Math.exp(-dt / RADIO_DOLLY_TAU))

    const over = hi >= RADIO_SHAKE_THRESHOLD || level >= RADIO_SHAKE_THRESHOLD
    if (over && !prevHit.current) shake.current = RADIO_SHAKE_AMP
    prevHit.current = over
    shake.current += (0 - shake.current) * (1 - Math.exp(-dt / RADIO_SHAKE_DECAY_TAU))

    camera.getWorldDirection(_fwd)
    camera.position.addScaledVector(_fwd, dolly.current)
    if (shake.current > 0) {
      camera.position.x += (Math.random() - 0.5) * 2 * shake.current
      camera.position.y += (Math.random() - 0.5) * 2 * shake.current
      camera.position.z += (Math.random() - 0.5) * 2 * shake.current
    }
  }, RADIO_CAMERA_PRIORITY)

  return null
})

/**
 * Soft frosted-glass Bloom over the whole scene. Built IMPERATIVELY (BloomEffect + EffectPass + <primitive>),
 * exactly like the working MenuEdgeGlow — NOT the <Bloom> wrapper, whose useMemo([JSON.stringify(props)])
 * re-reconciles the composer on every parent re-render and crashes. memo + stable props → mounts once.
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
