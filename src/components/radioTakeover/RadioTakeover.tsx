import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { HalfFloatType } from 'three'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import type { AudioAnalysis } from '../../game/audio/AudioAnalysis'
import monoFontUrl from '../../ui/fonts/share-tech-mono-cyrillic.ttf?url'

/**
 * Radio "takeover": when the Radio screen is active, the MenuBackdrop turns into a full-screen audio visualizer.
 * Four music-reactive effects, all driven by `analysis` each frame, mounted ONLY while radioMode is set:
 *   1) a SOFT, frosted-glass full-scene Bloom whose intensity ∝ music level (eased in over ~0.2s);
 *   2) a camera dolly (breathing) + beat-shake, applied additively AFTER CameraRig;
 *   3) stern color-emoji rain IN FRONT of the balls (pooled sprites), falling slowly but "dashing" down on beats;
 *   4) the current Strudel code rendered in-scene as semi-transparent monospace text (under a Suspense boundary,
 *      since drei <Text> suspends while its font loads — without the boundary the whole Canvas crashes).
 * The normal menu (radioMode === undefined) never mounts any of this.
 */

// --- Bloom (frosted-glass) ----------------------------------------------------------------------
const RADIO_BLOOM_FADE_MS = 200          // 0.2s ease in when radioMode toggles
const RADIO_BLOOM_BASE = 0.35            // hazy glow even in silence (the screen reads as "lit")
const RADIO_BLOOM_GAIN = 1.4             // extra intensity at the music peak
const RADIO_BLOOM_THRESHOLD = 0.0        // bloom EVERYTHING → diffuse haze, not crisp edges
const RADIO_BLOOM_SMOOTHING = 0.9        // generous smoothing → soft falloff
const RADIO_BLOOM_RADIUS = 0.95          // large radius → wide, blurry halo ("light through fogged glass")
const RADIO_BLOOM_LEVEL_GAIN = 1.6       // audio gain before the √ perceptual curve
const RADIO_BLOOM_LEVEL_SMOOTH = 0.18    // per-frame level smoothing

// --- Camera dolly + shake -----------------------------------------------------------------------
const RADIO_CAMERA_PRIORITY = 10         // run AFTER CameraRig (default priority 0)
const RADIO_DOLLY_RANGE = 1.2            // world units the camera "breathes" toward the scene at the peak
const RADIO_DOLLY_TAU = 0.12             // dolly easing time-constant
const RADIO_SHAKE_THRESHOLD = 0.6        // band/level magnitude that triggers a beat-shake
const RADIO_SHAKE_AMP = 0.06             // world units of jitter at a fresh hit
const RADIO_SHAKE_DECAY_TAU = 0.06       // shake amplitude decays over a few frames
const RADIO_SHAKE_BAND = 7               // high-frequency band index watched for hits
const RADIO_BANDS = 8                    // spectrum resolution

// --- Emoji rain ---------------------------------------------------------------------------------
const RADIO_EMOJI_MAX = 48               // pooled sprite count (recycled — no per-frame allocation)
const RADIO_EMOJI_BASE_RATE = 2          // spawns/sec in silence
const RADIO_EMOJI_RATE_GAIN = 22         // extra spawns/sec at the music peak
const RADIO_EMOJI_BASE_SPEED = 0.7       // SLOW base fall speed (world u/s)
const RADIO_EMOJI_DASH_MUL = 7.0         // fall-speed multiplier at a fresh beat ("dash" down)
const RADIO_EMOJI_DASH_DECAY_TAU = 0.16  // the dash multiplier eases back to 1 over ~0.5s
const RADIO_EMOJI_BEAT_DELTA = 0.10      // a sudden rise in level this big = a beat (transient)
const RADIO_EMOJI_SPRITE_PX = 64         // canvas glyph resolution
const RADIO_EMOJI_FONT_PX = 48           // glyph font size inside the canvas
const RADIO_EMOJI_SCALE = 0.55           // sprite world size
const RADIO_EMOJI_SPAWN_Y = 4.0          // top of the fall field (world Y, relative to the field group)
const RADIO_EMOJI_KILL_Y = -3.5          // bottom: below this a sprite recycles
const RADIO_EMOJI_SPREAD_X = 7.0         // horizontal spread of the field
const RADIO_EMOJI_DEPTH = 3.2            // distance in front of the camera (sprites also draw over everything)
const RADIO_EMOJI_RENDER_ORDER = 20      // + depthTest:false → always IN FRONT of the balls
const RADIO_EMOJI_DRIFT = 0.3            // small sideways drift so the rain isn't perfectly vertical

// Stern emoji sets (matching the dark arcade-FPS style) — keyed by a substring of the mood id; else the fallback.
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

// --- Strudel code text --------------------------------------------------------------------------
const RADIO_CODE_OPACITY = 0.35
const RADIO_CODE_SIZE = 0.16
const RADIO_CODE_COLOR = '#bcd2ff'
const RADIO_CODE_MAX_LINES = 14
const RADIO_CODE_LINE_HEIGHT = 1.25
const RADIO_CODE_POS: [number, number, number] = [-3.0, -1.4, -2.2]

// Shared scratch — no per-frame allocations.
const _fwd = new THREE.Vector3()
const _bands = new Float32Array(RADIO_BANDS)

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
 * Stern color-emoji rain IN FRONT of the balls. Color emoji can't be SDF text, so each glyph is rasterized to a
 * canvas → CanvasTexture → Sprite (depthTest off + high renderOrder → always drawn over the scene). Sprites are
 * pooled/recycled. They fall SLOWLY; a shared `dashMul` spikes on each beat (a sudden level rise) and eases back,
 * so on every kick the whole rain "dashes" downward, then settles.
 */
function EmojiRain({ analysis, mood }: { analysis?: AudioAnalysis; mood: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const camera = useThree(s => s.camera)
  const spawnAcc = useRef(0)
  const dashMul = useRef(1)
  const prevLevel = useRef(0)

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

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const g = groupRef.current
    if (!g) return
    // Park the field a few units in front of the camera so the rain reads across the screen.
    camera.getWorldDirection(_fwd)
    g.position.copy(camera.position).addScaledVector(_fwd, RADIO_EMOJI_DEPTH)
    g.quaternion.copy(camera.quaternion)

    const level = analysis?.level() ?? 0
    // Beat = a sudden rise in level → spike the shared dash multiplier; it eases back to 1 ("dash then settle").
    if (level - prevLevel.current > RADIO_EMOJI_BEAT_DELTA) dashMul.current = RADIO_EMOJI_DASH_MUL
    prevLevel.current = level
    dashMul.current += (1 - dashMul.current) * (1 - Math.exp(-dt / RADIO_EMOJI_DASH_DECAY_TAU))
    const fallSpeed = RADIO_EMOJI_BASE_SPEED * dashMul.current

    // Spawn rate scales with the level (denser rain on louder parts).
    spawnAcc.current += (RADIO_EMOJI_BASE_RATE + RADIO_EMOJI_RATE_GAIN * level) * dt
    while (spawnAcc.current >= 1) {
      spawnAcc.current -= 1
      const free = drops.find(d => !d.active)
      if (!free) break
      free.active = true
      free.sprite.visible = true
      free.sprite.position.set((Math.random() - 0.5) * RADIO_EMOJI_SPREAD_X, RADIO_EMOJI_SPAWN_Y, 0)
      free.vx = (Math.random() - 0.5) * 2 * RADIO_EMOJI_DRIFT
    }
    // Advance active drops at the shared (beat-dashing) fall speed; recycle below the kill line.
    for (const d of drops) {
      if (!d.active) continue
      d.sprite.position.y -= fallSpeed * dt
      d.sprite.position.x += d.vx * dt
      if (d.sprite.position.y <= RADIO_EMOJI_KILL_Y) { d.active = false; d.sprite.visible = false }
    }
  })

  return <group ref={groupRef} />
}

/** Camera dolly + beat-shake, applied AFTER CameraRig as an additive offset (returns to 0 on unmount). */
function RadioCameraMod({ analysis }: { analysis?: AudioAnalysis }) {
  const camera = useThree(s => s.camera)
  const dolly = useRef(0)
  const shake = useRef(0)
  const prevHit = useRef(false)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const level = analysis?.level() ?? 0
    analysis?.bands(_bands)
    const hi = _bands[RADIO_SHAKE_BAND] ?? 0

    const target = RADIO_DOLLY_RANGE * level
    dolly.current += (target - dolly.current) * (1 - Math.exp(-dt / RADIO_DOLLY_TAU))

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
}

/** Current Strudel code in-scene (semi-transparent monospace). Suspends while the font loads → keep under Suspense. */
function RadioCode({ code }: { code: string }) {
  const text = useMemo(() => code.split('\n').slice(0, RADIO_CODE_MAX_LINES).join('\n'), [code])
  return (
    <Text
      font={monoFontUrl}
      position={RADIO_CODE_POS}
      fontSize={RADIO_CODE_SIZE}
      color={RADIO_CODE_COLOR}
      anchorX="left"
      anchorY="top"
      lineHeight={RADIO_CODE_LINE_HEIGHT}
      fillOpacity={RADIO_CODE_OPACITY}
      raycast={() => null}
    >
      {text}
    </Text>
  )
}

/** Soft frosted-glass Bloom over the whole scene, intensity driven by music and eased in by `fade` (0..1). */
function RadioBloom({ analysis, fade }: { analysis?: AudioAnalysis; fade: React.RefObject<number> }) {
  const bloomRef = useRef<{ intensity: number } | null>(null)
  const lvl = useRef(0)

  useFrame(() => {
    if (!bloomRef.current) return
    const raw = Math.min(1, Math.sqrt((analysis?.level() ?? 0) * RADIO_BLOOM_LEVEL_GAIN))
    lvl.current += (raw - lvl.current) * RADIO_BLOOM_LEVEL_SMOOTH
    bloomRef.current.intensity = (RADIO_BLOOM_BASE + RADIO_BLOOM_GAIN * lvl.current) * (fade.current ?? 0)
  })

  return (
    <EffectComposer frameBufferType={HalfFloatType}>
      <Bloom
        ref={bloomRef as never}
        intensity={RADIO_BLOOM_BASE}
        luminanceThreshold={RADIO_BLOOM_THRESHOLD}
        luminanceSmoothing={RADIO_BLOOM_SMOOTHING}
        radius={RADIO_BLOOM_RADIUS}
        mipmapBlur
      />
    </EffectComposer>
  )
}

/** The full radio takeover, rendered INSIDE the Canvas only when radioMode is set. */
export function RadioTakeover({ radioMode, analysis }: { radioMode: { code: string; mood: string }; analysis?: AudioAnalysis }) {
  const fade = useRef(0)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    fade.current += (1 - fade.current) * (1 - Math.exp(-dt / (RADIO_BLOOM_FADE_MS / 1000)))
  })

  return (
    <Suspense fallback={null}>
      <RadioCameraMod analysis={analysis} />
      <EmojiRain analysis={analysis} mood={radioMode.mood} />
      <RadioCode code={radioMode.code} />
      <RadioBloom analysis={analysis} fade={fade} />
    </Suspense>
  )
}
