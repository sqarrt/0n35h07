import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Color, Mesh, ShaderMaterial, SphereGeometry, AdditiveBlending, FrontSide } from 'three'
import type { Group } from 'three'
import { BALL_RADIUS, BALL_SEGMENTS, PREVIEW_SPIN_SPEED, HOST_ID, OPPONENT_ID, MENU_ANIM_TAU } from '../constants'
import type { BallModel } from '../constants'
import type { LobbyView } from '../net/LobbySession'
import { createBallMaterial, createBallRing } from '../game/fx/ballMaterial'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'

// Тонкий неоновый контур шара: узкая fresnel-кромка по силуэту (бело-голубая, additive) + мягкий
// внешний свет даёт Bloom. Яркость пульсирует по звуку.
const GLOW_LEVEL_GAIN = 3.2     // усиление RMS (звук тихий) для glow
const GLOW_SMOOTH = 0.18        // сглаживание пульсации
const GLOW_BASE = 0.45          // постоянная яркость контура в покое (контур всегда виден тонко)
const GLOW_GAIN = 1.0           // добавка яркости на пике звука
const GLOW_SHELL_SCALE = 1.02   // оболочка почти вровень с шаром → контур точно по краю силуэта
const GLOW_FRESNEL_POW = 5.0    // высокая степень → тонкая кромка (неоновая линия, не широкий ореол)
const GLOW_NEON_WHITE = 0.4     // подмешать белого в кромку → неоновая яркость, не просто цвет

/** Тонкая светящаяся кромка по силуэту шара: fresnel, additive. Яркость/цвет задаются снаружи. */
function createGlowShell(color: string) {
  const uColor = { value: new Color(color) }
  const uIntensity = { value: 0 }
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: FrontSide,
    uniforms: { uColor, uIntensity },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV;
      void main() {
        float rim = pow(1.0 - max(dot(vN, vV), 0.0), ${GLOW_FRESNEL_POW.toFixed(1)});
        vec3 neon = mix(uColor, vec3(1.0), ${GLOW_NEON_WHITE.toFixed(2)});
        gl_FragColor = vec4(neon, rim * uIntensity);
      }`,
  })
  const mesh = new Mesh(new SphereGeometry(BALL_RADIUS * GLOW_SHELL_SCALE, BALL_SEGMENTS, BALL_SEGMENTS), material)
  mesh.userData.noRaycast = true
  return {
    mesh,
    setColor: (c: Color) => uColor.value.copy(c),
    setIntensity: (i: number) => { uIntensity.value = i },
    dispose: () => { mesh.geometry.dispose(); material.dispose() },
  }
}

// Анимация переезда/появления модельки.
const DAMP_TAU = MENU_ANIM_TAU // переезд позиции/масштаба — общий TAU с подложкой меню (одинаковая скорость)
const FADE_TAU = 0.13          // появление (opacity) чуть дольше переезда — мягче выходит из фейда (~0.4с)
const COLOR_TAU = 0.067        // плавная смена цвета модельки (~0.2с до 95%) — основной↔резервный на «войти»
const EXIT_MS = 400            // сколько держим выходящий шар смонтированным, пока он уезжает за край
const BIG_FRACTION = 0.4       // радиус крупного шара = доля высоты viewport (диаметр ≈ 0.8 высоты)
const SETTINGS_X_FRACTION = 0.26   // смещение влево на экране настроек (доля ширины)
const SETTINGS_H_FRACTION = 0.32   // и масштаб поменьше, чтобы шар влез целиком слева
const SETTINGS_W_FRACTION = 0.22

export type MenuMode = 'menu' | 'join' | 'lobby' | 'settings'
type Pos = 'center' | 'left-edge' | 'right-edge' | 'settings-left'
interface BallSpec { color: string; model: BallModel }
interface ActiveBall { key: string; spec: BallSpec; pos: Pos; slideIn: boolean }

interface Viewport { width: number; height: number }

/** Целевые мировые координаты и масштаб для позиции (из размеров viewport — resize-safe). */
function resolveTarget(pos: Pos, vp: Viewport): { x: number; scale: number } {
  const big = (vp.height * BIG_FRACTION) / BALL_RADIUS
  switch (pos) {
    case 'center':       return { x: 0, scale: big }
    case 'left-edge':    return { x: -vp.width / 2, scale: big }   // центр на кромке → половина за кадром
    case 'right-edge':   return { x: vp.width / 2, scale: big }
    case 'settings-left': {
      const scale = Math.min(vp.height * SETTINGS_H_FRACTION, vp.width * SETTINGS_W_FRACTION) / BALL_RADIUS
      return { x: -vp.width * SETTINGS_X_FRACTION, scale }
    }
  }
}

/** Стартовая x за кадром для шара, который должен «выехать» к своей кромке. */
function offscreenX(pos: Pos, vp: Viewport): number {
  return pos === 'right-edge' ? vp.width : -vp.width
}

/** Свет медленно облетает шары — блик скользит, модели читаются как «живое» 3D. */
function OrbitingLight() {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += PREVIEW_SPIN_SPEED * dt })
  return (
    <group ref={ref}>
      <directionalLight position={[10, 10, 5]} intensity={1} />
    </group>
  )
}

/**
 * Шар игрока с анимируемыми x/scale/opacity/цветом. Каждый кадр тянет текущие значения к целевым
 * экспоненциальным демпфированием (FPS-независимо). Появляется фейдом 0.2с; при `slideIn` — выезжает
 * из-за кадра к своей кромке; при `exiting` — уезжает за край и гаснет (перед размонтированием). Тот же
 * инстанс при смене `pos` едет к новой цели, при смене `spec.color` — плавно перекрашивается.
 */
function AnimatedBall({ spec, pos, slideIn, exiting = false, analysis }: { spec: BallSpec; pos: Pos; slideIn: boolean; exiting?: boolean; analysis?: AudioAnalysis }) {
  const viewport = useThree(s => s.viewport)
  const groupRef = useRef<Group>(null)
  const glow = useRef(0)
  // Материал мемоизируем по МОДЕЛИ (не цвету): смена цвета не пересоздаёт материал, цвет лерпим в кадре.
  const { material, tick } = useMemo(() => {
    const m = createBallMaterial(spec.color, spec.model)
    m.material.opacity = 0   // без вспышки до первого кадра
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.model])
  const ring = useMemo(() => (spec.model === 'planet' ? createBallRing(spec.color) : null), [spec.model]) // eslint-disable-line react-hooks/exhaustive-deps
  const shell = useMemo(() => createGlowShell(spec.color), []) // eslint-disable-line react-hooks/exhaustive-deps -- цвет лерпим в кадре
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => ring?.dispose(), [ring])
  useEffect(() => () => shell.dispose(), [shell])

  const targetColor = useMemo(() => new Color(spec.color), [spec.color])
  const cur = useRef<{ x: number; scale: number; opacity: number } | null>(null)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const t = resolveTarget(pos, viewport)
    const targetX = exiting ? offscreenX(pos, viewport) : t.x   // выход — уезжаем за край
    const targetOpacity = exiting ? 0 : 1
    if (!cur.current) {
      cur.current = { x: slideIn ? offscreenX(pos, viewport) : t.x, scale: t.scale, opacity: 0 }
    }
    const k = 1 - Math.exp(-dt / DAMP_TAU)
    const kf = 1 - Math.exp(-dt / FADE_TAU)
    const kc = 1 - Math.exp(-dt / COLOR_TAU)
    const c = cur.current
    c.x += (targetX - c.x) * k
    c.scale += (t.scale - c.scale) * k
    c.opacity += (targetOpacity - c.opacity) * kf
    material.color.lerp(targetColor, kc)
    material.opacity = c.opacity
    // Glow по звуку: ореол по КРАЮ шара (fresnel-оболочка), яркость пульсирует с уровнем → Bloom даёт гало.
    const lvl = Math.min(1, (analysis?.level() ?? 0) * GLOW_LEVEL_GAIN)
    glow.current += (lvl - glow.current) * GLOW_SMOOTH
    shell.setColor(material.color)
    shell.setIntensity((GLOW_BASE + glow.current * GLOW_GAIN) * c.opacity)
    ring?.setOpacity(c.opacity)
    tick(dt); ring?.tick(dt)
    const g = groupRef.current
    if (g) { g.position.x = c.x; g.scale.setScalar(c.scale) }
  })

  return (
    <group ref={groupRef} scale={0.0001}>
      <mesh>
        <sphereGeometry args={[BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS]} />
        <primitive object={material} attach="material" />
        {ring && <primitive object={ring.mesh} />}
      </mesh>
      <primitive object={shell.mesh} />
    </group>
  )
}

const specOf = (color: string, model?: BallModel): BallSpec => ({ color, model: model ?? 'smooth' })

/** Какие шары активны и куда едут — по текущему режиму/состоянию лобби. Ключ `player` стабилен между экранами. */
function computeBalls(mode: MenuMode, player: BallSpec, lobby: LobbyView | null): ActiveBall[] {
  if (mode === 'settings') return [{ key: 'player', spec: player, pos: 'settings-left', slideIn: false }]
  if (mode !== 'lobby' || !lobby) return [{ key: 'player', spec: player, pos: 'center', slideIn: false }]

  const host = lobby.roster.find(r => r.id === HOST_ID)
  const opp = lobby.roster.find(r => r.id === OPPONENT_ID)
  if (!host) return [{ key: 'player', spec: player, pos: 'center', slideIn: false }]
  if (!opp) return [{ key: 'player', spec: specOf(host.color, host.ballModel), pos: 'center', slideIn: false }]

  // Двое: хост слева, соперник справа. Свой шар (player) — на своей стороне, другой выезжает.
  const selfIsHost = lobby.localPlayerId === HOST_ID
  const self = selfIsHost ? host : opp
  const other = selfIsHost ? opp : host
  return [
    { key: 'player', spec: specOf(self.color, self.ballModel), pos: selfIsHost ? 'left-edge' : 'right-edge', slideIn: false },
    { key: 'other', spec: specOf(other.color, other.ballModel), pos: selfIsHost ? 'right-edge' : 'left-edge', slideIn: true },
  ]
}

type RenderedBall = ActiveBall & { exiting?: boolean }

/** Подпись активных шаров — стабильная зависимость эффекта (computeBalls даёт новые объекты каждый рендер). */
function signOf(balls: ActiveBall[]): string {
  return balls.map(b => `${b.key}:${b.spec.color}:${b.spec.model}:${b.pos}:${b.slideIn ? 1 : 0}`).join('|')
}

function Scene({ mode, player, lobby, analysis }: { mode: MenuMode; player: BallSpec; lobby: LobbyView | null; analysis?: AudioAnalysis }) {
  const active = computeBalls(mode, player, lobby)
  const sign = signOf(active)
  const [rendered, setRendered] = useState<RenderedBall[]>(active)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const activeKeys = new Set(active.map(b => b.key))
    setRendered(prev => {
      const next: RenderedBall[] = active.map(b => ({ ...b }))   // активные — без exiting
      for (const b of prev) {
        if (activeKeys.has(b.key)) {                              // вернулся в активные → отменить выход
          const tm = timers.current.get(b.key)
          if (tm) { clearTimeout(tm); timers.current.delete(b.key) }
          continue
        }
        next.push({ ...b, exiting: true })                       // пропал → держим, пока уезжает за край
        if (!timers.current.has(b.key)) {
          const tm = setTimeout(() => {
            timers.current.delete(b.key)
            setRendered(r => r.filter(x => x.key !== b.key))
          }, EXIT_MS)
          timers.current.set(b.key, tm)
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign])

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear() }, [])

  return (
    <>
      {rendered.map(b => <AnimatedBall key={b.key} spec={b.spec} pos={b.pos} slideIn={b.slideIn} exiting={b.exiting} analysis={analysis} />)}
    </>
  )
}

interface MenuBackdropProps { mode: MenuMode; player: BallSpec; lobby?: LobbyView | null; analysis?: AudioAnalysis }

/**
 * Персистентный прозрачный фон меню-экранов: крупная «живая» моделька игрока, резко (но не мгновенно)
 * переезжающая между позициями при смене экрана; в лобби с двумя игроками — два шара по краям.
 * Монтируется на уровне App для всех экранов кроме игры (при возврате из игры — заново → фейд-ин).
 */
export function MenuBackdrop({ mode, player, lobby, analysis }: MenuBackdropProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas gl={{ alpha: true }} dpr={[1, 2]} camera={{ position: [0, 3.02, 5.18], fov: 45 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
        <ambientLight intensity={0.4} />
        <OrbitingLight />
        <Scene mode={mode} player={player} lobby={lobby ?? null} analysis={analysis} />
        {/* Bloom подхватывает эмиссив шаров → пульсирующий ореол по звуку. alpha сохраняем для прозрачного фона. */}
        <EffectComposer enableNormalPass={false}>
          <Bloom intensity={0.7} luminanceThreshold={0.35} luminanceSmoothing={0.25} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
