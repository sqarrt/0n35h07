import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { HalfFloatType } from 'three'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import type { AudioAnalysis } from '../../game/audio/AudioAnalysis'
import monoFontUrl from '../../ui/fonts/share-tech-mono-cyrillic.ttf?url'

/**
 * Radio "takeover": when the Radio screen is active, the MenuBackdrop turns into a full-screen audio visualizer.
 * Four music-reactive effects, all driven by `analysis` each frame, all mounted ONLY while radioMode is set:
 *   1) a SOFT, frosted-glass full-scene Bloom (NOT the sharp edge-glow) whose intensity ∝ music level;
 *   2) a camera dolly (breathing in/out) + beat-shake, applied additively AFTER CameraRig;
 *   3) color-emoji rain (pooled THREE.Sprite + CanvasTexture), rate/speed ∝ level, set chosen by mood;
 *   4) the current Strudel code rendered in-scene as semi-transparent monospace text (so the bloom glows it too).
 * The normal menu (radioMode === undefined) never mounts any of this.
 */

// --- Bloom (frosted-glass) ----------------------------------------------------------------------
const RADIO_BLOOM_FADE_MS = 200          // 0.2s ease in/out when radioMode toggles
const RADIO_BLOOM_BASE = 0.35            // hazy glow even in silence (the screen reads as "lit")
const RADIO_BLOOM_GAIN = 1.4             // extra intensity at the music peak
const RADIO_BLOOM_THRESHOLD = 0.0        // bloom EVERYTHING (no luminance cutoff) → diffuse haze, not crisp edges
const RADIO_BLOOM_SMOOTHING = 0.9        // generous smoothing → soft falloff
const RADIO_BLOOM_RADIUS = 0.95          // large radius → wide, blurry halo ("light through fogged glass")
const RADIO_BLOOM_LEVEL_GAIN = 1.6       // audio gain before the √ perceptual curve
const RADIO_BLOOM_LEVEL_SMOOTH = 0.18    // per-frame level smoothing (matches the menu glow feel)

// --- Camera dolly + shake -----------------------------------------------------------------------
const RADIO_CAMERA_PRIORITY = 10         // run AFTER CameraRig (which has the default priority 0)
const RADIO_DOLLY_RANGE = 1.2            // world units the camera "breathes" toward the scene at the peak
const RADIO_DOLLY_TAU = 0.12             // dolly easing time-constant (smooth, ~0.36s to settle)
const RADIO_SHAKE_THRESHOLD = 0.6        // band/level magnitude that triggers a beat-shake
const RADIO_SHAKE_AMP = 0.06             // world units of jitter at a fresh hit
const RADIO_SHAKE_DECAY_TAU = 0.06       // shake amplitude decays over a few frames
const RADIO_SHAKE_BAND = 7               // high-frequency band index watched for hits
const RADIO_BANDS = 8                    // spectrum resolution for the shake trigger

// --- Emoji rain ---------------------------------------------------------------------------------
const RADIO_EMOJI_MAX = 48               // pooled sprite count (recycled — no per-frame allocation)
const RADIO_EMOJI_BASE_RATE = 2          // spawns/sec in silence
const RADIO_EMOJI_RATE_GAIN = 26         // extra spawns/sec at the music peak
const RADIO_EMOJI_BASE_SPEED = 1.4       // fall speed (world u/s) in silence
const RADIO_EMOJI_SPEED_GAIN = 5.0       // extra fall speed at the peak
const RADIO_EMOJI_SPRITE_PX = 64         // canvas glyph resolution
const RADIO_EMOJI_FONT_PX = 48           // glyph font size inside the canvas
const RADIO_EMOJI_SCALE = 0.55           // sprite world size
const RADIO_EMOJI_SPAWN_Y = 4.0          // top of the fall field (world Y, relative to the field group)
const RADIO_EMOJI_KILL_Y = -3.5          // bottom: below this a sprite recycles
const RADIO_EMOJI_SPREAD_X = 7.0         // horizontal spread of the field
const RADIO_EMOJI_DEPTH = -6.0           // field placement in front of the camera (along -Z of the rig group)
const RADIO_EMOJI_DRIFT = 0.4            // small sideways drift (world u/s) so the rain isn't perfectly vertical

// Emoji set by mood — keyed by a substring of the mood id; first match wins, else the fallback.
const MOOD_EMOJI: Record<string, string[]> = {
  dark: ['🖤', '🔥', '💀', '🌑', '⚡'],
  techno: ['🖤', '🔥', '💀', '🌑', '⚡'],
  dub: ['🌊', '💧', '🍃', '🌫️'],
  deep: ['🌊', '💧', '🍃', '🌫️'],
  acid: ['🧪', '☢️', '🟢', '👾'],
}
const FALLBACK_EMOJI = ['🎵', '🔊', '💫', '⭐']

function emojiSetFor(mood: string): string[] {
  const id = mood.toLowerCase()
  for (const key of Object.keys(MOOD_EMOJI)) {
    if (id.includes(key)) return MOOD_EMOJI[key]
  }
  return FALLBACK_EMOJI
}

// --- Strudel code text --------------------------------------------------------------------------
const RADIO_CODE_OPACITY = 0.35
const RADIO_CODE_SIZE = 0.16             // troika font size (world units)
const RADIO_CODE_COLOR = '#bcd2ff'
const RADIO_CODE_MAX_LINES = 14          // clamp very long code so it doesn't fill the screen
const RADIO_CODE_LINE_HEIGHT = 1.25
const RADIO_CODE_POS: [number, number, number] = [-3.0, -1.4, -2.2]  // lower-left, behind the balls

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

/** One pooled raining emoji: a Sprite plus its physical state (active flag, velocity). */
interface Drop {
  sprite: THREE.Sprite
  active: boolean
  vy: number
  vx: number
}

/**
 * Color-emoji rain in WebGL. Color emoji can't be drawn by SDF text, so each glyph is rasterized to a small
 * canvas → CanvasTexture → SpriteMaterial. Sprites are POOLED (fixed count) and recycled; textures are cached
 * per glyph. The field hangs in front of the camera (a child of the rig group) so the rain reads across-screen.
 */
function EmojiRain({ analysis, mood }: { analysis?: AudioAnalysis; mood: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const camera = useThree(s => s.camera)
  const spawnAcc = useRef(0)

  // Texture cache per glyph (reused across spawns) + the sprite pool. Rebuilt only when the mood set changes.
  const { textures, drops } = useMemo(() => {
    const set = emojiSetFor(mood)
    const texCache = new Map<string, THREE.CanvasTexture>()
    const texList = set.map(e => {
      const t = makeEmojiTexture(e)
      texCache.set(e, t)
      return t
    })
    const pool: Drop[] = []
    for (let i = 0; i < RADIO_EMOJI_MAX; i++) {
      const mat = new THREE.SpriteMaterial({ map: texList[i % texList.length], transparent: true, depthWrite: false })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.setScalar(RADIO_EMOJI_SCALE)
      sprite.visible = false
      pool.push({ sprite, active: false, vy: 0, vx: 0 })
    }
    return { textures: texList, drops: pool }
  }, [mood])

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    for (const d of drops) g.add(d.sprite)
    return () => {
      for (const d of drops) {
        g.remove(d.sprite)
        ;(d.sprite.material as THREE.SpriteMaterial).dispose()
      }
      for (const t of textures) t.dispose()
    }
  }, [drops, textures])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const g = groupRef.current
    if (!g) return
    // Park the field in front of the camera: follow position + forward axis, so the rain is always on-screen.
    camera.getWorldDirection(_fwd)
    g.position.copy(camera.position).addScaledVector(_fwd, -RADIO_EMOJI_DEPTH)
    g.quaternion.copy(camera.quaternion)

    const level = analysis?.level() ?? 0
    // Spawn rate and fall speed both scale with the music level.
    const rate = RADIO_EMOJI_BASE_RATE + RADIO_EMOJI_RATE_GAIN * level
    spawnAcc.current += rate * dt
    while (spawnAcc.current >= 1) {
      spawnAcc.current -= 1
      const free = drops.find(d => !d.active)
      if (!free) break
      free.active = true
      free.sprite.visible = true
      free.sprite.position.set(
        (Math.random() - 0.5) * RADIO_EMOJI_SPREAD_X,
        RADIO_EMOJI_SPAWN_Y,
        0,
      )
      free.vy = -(RADIO_EMOJI_BASE_SPEED + RADIO_EMOJI_SPEED_GAIN * level)
      free.vx = (Math.random() - 0.5) * 2 * RADIO_EMOJI_DRIFT
    }
    // Advance active drops; recycle below the kill line.
    for (const d of drops) {
      if (!d.active) continue
      d.sprite.position.y += d.vy * dt
      d.sprite.position.x += d.vx * dt
      if (d.sprite.position.y <= RADIO_EMOJI_KILL_Y) {
        d.active = false
        d.sprite.visible = false
      }
    }
  })

  return <group ref={groupRef} />
}

/**
 * Camera dolly + beat-shake, applied AFTER CameraRig (higher renderPriority) as an additive offset to the camera
 * position, so it doesn't fight the rig's lerp and returns cleanly to 0 when the takeover unmounts.
 */
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

    // Dolly: ease an offset toward (range × level) along the camera forward axis ("breathing").
    const target = RADIO_DOLLY_RANGE * level
    const k = 1 - Math.exp(-dt / RADIO_DOLLY_TAU)
    dolly.current += (target - dolly.current) * k

    // Shake: a rising-edge trigger on a high band OR the overall level → a fresh decaying jitter.
    const overThreshold = hi >= RADIO_SHAKE_THRESHOLD || level >= RADIO_SHAKE_THRESHOLD
    if (overThreshold && !prevHit.current) shake.current = RADIO_SHAKE_AMP
    prevHit.current = overThreshold
    const sd = 1 - Math.exp(-dt / RADIO_SHAKE_DECAY_TAU)
    shake.current += (0 - shake.current) * sd

    // Apply additively: forward dolly + random per-axis jitter.
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

/** The current Strudel code rendered in-scene as semi-transparent monospace text (bloom glows it too). */
function RadioCode({ code }: { code: string }) {
  // Clamp to a sane number of lines so very long programs don't dominate the screen.
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
      // Code text must not be a raycast target (it's pure decoration).
      raycast={() => null}
    >
      {text}
    </Text>
  )
}

/**
 * Soft frosted-glass Bloom: a SECOND, full-scene composer used ONLY during the radio takeover (the sharp
 * MenuEdgeGlow composer is gated off meanwhile, so only one composer renders at a time). The bloom is configured
 * for softness — large radius, zero luminance threshold, mipmapBlur, generous smoothing — a wide hazy halo rather
 * than crisp edges. Its `intensity` is driven by music each frame and eased in/out over ~0.2s by `fade` (0..1).
 */
function RadioBloom({ analysis, fade }: { analysis?: AudioAnalysis; fade: React.RefObject<number> }) {
  const bloomRef = useRef<{ intensity: number } | null>(null)
  const lvl = useRef(0)

  useFrame(() => {
    if (!bloomRef.current) return
    const raw = Math.min(1, Math.sqrt((analysis?.level() ?? 0) * RADIO_BLOOM_LEVEL_GAIN))
    lvl.current += (raw - lvl.current) * RADIO_BLOOM_LEVEL_SMOOTH
    const f = fade.current ?? 0
    bloomRef.current.intensity = (RADIO_BLOOM_BASE + RADIO_BLOOM_GAIN * lvl.current) * f
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

/**
 * The full radio takeover, rendered INSIDE the Canvas only when radioMode is set. `fade` (a ref eased toward 1
 * over ~0.2s on mount, owned here) modulates the bloom; the in-scene effects (rain, code, camera) just run while
 * mounted. Unmounting removes everything and the bloom composer, restoring the plain menu.
 */
export function RadioTakeover({ radioMode, analysis }: { radioMode: { code: string; mood: string }; analysis?: AudioAnalysis }) {
  // Fade 0→1 over RADIO_BLOOM_FADE_MS on mount (and the unmount fade is implicit: the component is gone, so the
  // plain-menu composer takes over instantly — there's no lingering frame to ease, hence we only ease IN here).
  const fade = useRef(0)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const k = 1 - Math.exp(-dt / (RADIO_BLOOM_FADE_MS / 1000))
    fade.current += (1 - fade.current) * k
  })

  return (
    <>
      <RadioCameraMod analysis={analysis} />
      <EmojiRain analysis={analysis} mood={radioMode.mood} />
      <RadioCode code={radioMode.code} />
      <RadioBloom analysis={analysis} fade={fade} />
    </>
  )
}
