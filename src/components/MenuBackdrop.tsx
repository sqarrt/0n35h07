import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BALL_RADIUS, BALL_SEGMENTS, PREVIEW_SPIN_SPEED, HOST_ID, OPPONENT_ID, MENU_ANIM_TAU, BEAM_WINDUP, WINDUP_SHRINK_MS } from '../constants'
import type { BallModel, WindupStyle, RespawnStyle } from '../constants'
import type { LobbyView } from '../net/LobbySession'
import { resolveTarget, offscreenX } from './menuBallTargets'
import type { Pos, AppearancePart } from './menuBallTargets'
import { createBallMaterial, createBallRing } from '../game/fx/ballMaterial'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'
import { MenuEdgeGlow, MENU_GLOW_LAYER } from './MenuEdgeGlow'
import { createWindupFx } from '../game/fx/windup/createWindupFx'
import { BeamWeapon } from '../game/BeamWeapon'
import { createBeamFx } from '../game/fx/beam/createBeamFx'
import { createRespawnFx } from '../game/fx/respawn/createRespawnFx'
import type { WeaponContext } from '../game/abstractions'
import type { World } from '../game/World'
import { windupSfxEvent } from '../game/audio/sfx/windupSfx'
import type { ISfxEngine } from '../game/audio/sfx/types'

// Анимация переезда/появления модельки.
const DAMP_TAU = MENU_ANIM_TAU // переезд позиции/масштаба — общий TAU с подложкой меню (одинаковая скорость)
const FADE_TAU = 0.13          // появление (opacity) чуть дольше переезда — мягче выходит из фейда (~0.4с)
const COLOR_TAU = 0.067        // плавная смена цвета модельки (~0.2с до 95%) — основной↔резервный на «войти»
const EXIT_MS = 400            // сколько держим выходящий шар смонтированным, пока он уезжает за край
const WARMUP_FRAMES = 4        // кадров прогрева (компиляция дешёвых шейдеров шара за невидимым шаром) до старта фейда
const GLOW_MOUNT_DELAY_MS = 600 // отложенный монтаж glow-композера: после появления шара, чтобы компиляция его шейдеров не морозила вход
// Превью анимации заряда — на экране внешности: одноразовый прогон по клику (charge → fire → idle).
const PREVIEW_CHARGE_MS = BEAM_WINDUP        // зарядка — как у игрока
const PREVIEW_FIRE_MS = WINDUP_SHRINK_MS     // «сдувание» после выстрела
const PREVIEW_ORIGIN = new THREE.Vector3(0, 0, 0)   // центр шара в локальной системе группы
const PREVIEW_BEAM_LEN = BALL_RADIUS * 16    // длина луча выстрела превью (в локальных единицах группы)
// Косметический контекст для BeamWeapon превью: фаза оружия всегда idle → fire()/raycast не вызываются.
const PREVIEW_BEAM_CTX: WeaponContext = {
  world: { raycast: () => null } as unknown as World,
  muzzle: new THREE.Vector3(), aim: new THREE.Vector3(0, 0, -1), excludeIds: [],
}
const _beamEnd = new THREE.Vector3()         // scratch конца луча (без аллокаций в кадре)

// Подвкладка ВЫСТРЕЛ: шар справа сверху, прицел фиксированный — по диагонали вниз-влево
// (чуть на зрителя, чтобы пасть читалась в три четверти); луч уходит через свободную зону экрана.
const SHOT_AIM_DIR = new THREE.Vector3(-0.78, -0.55, 1.3).normalize()

// Превью респавна: один прогон по клику — смерть → призрак (проезд по кругу) → возрождение.
const RESPAWN_PREVIEW_GHOST_MS = 1200
const RESPAWN_PREVIEW_REBIRTH_MS = 500
const RESPAWN_CIRCLE_R = 1.4     // радиус кругового проезда призрака (локальные ед. до масштаба группы)

export type MenuMode = 'menu' | 'join' | 'lobby' | 'settings' | 'appearance'
// ringColor — «второй» цвет (кольцо планеты); *Seq — счётчики кликов (триггеры одноразовых превью).
interface BallSpec { color: string; model: BallModel; ringColor?: string; windupStyle?: WindupStyle; windupSeq?: number; respawnStyle?: RespawnStyle; respawnSeq?: number }
interface ActiveBall { key: string; spec: BallSpec; pos: Pos; slideIn: boolean }

/** Свет медленно облетает шары — блик скользит, модели читаются как «живое» 3D. */
function OrbitingLight() {
  const ref = useRef<THREE.Group>(null)
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
function AnimatedBall({ spec, pos, slideIn, exiting = false, hold = false, sfx }: { spec: BallSpec; pos: Pos; slideIn: boolean; exiting?: boolean; hold?: boolean; sfx?: ISfxEngine }) {
  const viewport = useThree(s => s.viewport)
  const groupRef = useRef<THREE.Group>(null)
  // Материал мемоизируем по МОДЕЛИ (не цвету): смена цвета не пересоздаёт материал, цвет лерпим в кадре.
  const { material, tick } = useMemo(() => {
    const m = createBallMaterial(spec.color, spec.model)
    m.material.opacity = 0   // без вспышки до первого кадра
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.model])
  const ring = useMemo(() => (spec.model === 'planet' ? createBallRing(spec.ringColor ?? spec.color) : null), [spec.model]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => ring?.dispose(), [ring])
  // Модель — на слой свечения (его рендерит depth-пасс MenuEdgeGlow); кольцу включаем depthWrite,
  // иначе оно не попадёт в depth-буфер и обводка его не захватит.
  useEffect(() => {
    groupRef.current?.traverse(o => o.layers.enable(MENU_GLOW_LAYER))
    if (ring) (ring.mesh.material as { depthWrite: boolean }).depthWrite = true
  }, [ring])

  // Превью анимации заряда — на экране внешности. fx живёт в масштабируемой группе шара →
  // origin/aimDir в ЛОКАЛЬНЫХ координатах группы (см. контракт WindupFrame).
  const isPreviewPos = pos === 'settings-left' || pos === 'shot-right' || pos === 'respawn-far'
  const fx = useMemo(() => (isPreviewPos && spec.windupStyle ? createWindupFx(spec.windupStyle) : null),
    [isPreviewPos, spec.windupStyle])
  useEffect(() => () => fx?.dispose(), [fx])
  // Луч выстрела превью — тот же BeamWeapon, что в матче (косметический playBeam), со стилевым визуалом.
  const beam = useMemo(() => (isPreviewPos ? new BeamWeapon({ beamFx: createBeamFx(spec.windupStyle ?? 'classic', spec.color) }) : null),
    [isPreviewPos, spec.color, spec.windupStyle])
  useEffect(() => () => beam?.dispose(), [beam])
  const cycle = useRef({ phase: 'idle' as 'charge' | 'fire' | 'idle', elapsed: 0 })
  // Счётчик кликов превью (windupSeq) монотонный и живёт в App: реагируем только на его ИЗМЕНЕНИЯ
  // после монтирования — вход на экран со «старым» значением превью не запускает.
  const lastSeqRef = useRef(spec.windupSeq ?? 0)
  // Триггер по клику на стиль: одноразовый прогон charge → fire → idle; звук — один раз на старте заряда.
  useEffect(() => {
    if (!fx) { if (spec.windupSeq !== undefined) lastSeqRef.current = spec.windupSeq; return }
    const seq = spec.windupSeq ?? 0
    if (seq !== 0 && seq !== lastSeqRef.current) {
      lastSeqRef.current = seq
      cycle.current = { phase: 'charge', elapsed: 0 }   // одноразовый прогон: charge → fire → idle
      sfx?.play2D(windupSfxEvent(spec.windupStyle, sfx))   // звук стиля — один раз на старте заряда
    } else {
      cycle.current = { phase: 'idle', elapsed: 0 }   // смена экрана/стиля без клика — нейтраль
    }
  }, [fx, spec.windupSeq, spec.windupStyle, sfx])
  // Превью респавна — стратегия по стилю; одноразовый прогон по клику (паттерн как у выстрела).
  const rfx = useMemo(() => (isPreviewPos ? createRespawnFx(spec.respawnStyle ?? 'echo', spec.color) : null),
    [isPreviewPos, spec.respawnStyle, spec.color])
  useEffect(() => () => rfx?.dispose(), [rfx])
  const respawnCycle = useRef({ phase: 'idle' as 'ghost' | 'rebirth' | 'idle', elapsed: 0 })
  const lastRespawnSeqRef = useRef(spec.respawnSeq ?? 0)
  useEffect(() => {
    if (!rfx) { if (spec.respawnSeq !== undefined) lastRespawnSeqRef.current = spec.respawnSeq; return }
    const seq = spec.respawnSeq ?? 0
    if (seq !== 0 && seq !== lastRespawnSeqRef.current) {
      lastRespawnSeqRef.current = seq
      respawnCycle.current = { phase: 'ghost', elapsed: 0 }
      rfx.onDeath(PREVIEW_ORIGIN)                       // рассыпание/хлопок из центра шара
      sfx?.play2D('death')
    } else {
      respawnCycle.current = { phase: 'idle', elapsed: 0 }   // смена экрана/стиля без клика — нейтраль
    }
  }, [rfx, spec.respawnSeq, spec.respawnStyle, sfx])
  const respawnFrameRef = useRef<{ ghost: number | null; sinceRebirthMs: number; baseColor: THREE.Color; origin: THREE.Vector3; visible: boolean } | null>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const dampedColorRef = useRef<THREE.Color | null>(null)
  const aimDirRef = useRef<THREE.Vector3 | null>(null)
  // frameRef: заполняется в первом useFrame (до этого не используется, только внутри useFrame)
  const frameRef = useRef<{ progress: number; shrink: number; baseColor: THREE.Color; aimDir: THREE.Vector3; origin: THREE.Vector3; visible: boolean } | null>(null)
  const camera = useThree(s => s.camera)

  const targetColor = useMemo(() => new THREE.Color(spec.color), [spec.color])
  const targetRingColor = useMemo(() => new THREE.Color(spec.ringColor ?? spec.color), [spec.ringColor, spec.color])
  const cur = useRef<{ x: number; y: number; z: number; scale: number; opacity: number } | null>(null)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const t = resolveTarget(pos, viewport)
    const targetX = exiting ? offscreenX(pos, viewport) : t.x   // выход — уезжаем за край
    const targetOpacity = exiting ? 0 : 1
    // Ленивая инициализация мутабельных вспомогательных объектов — за пределами рендера.
    if (!dampedColorRef.current) dampedColorRef.current = new THREE.Color(spec.color)
    if (!aimDirRef.current) aimDirRef.current = new THREE.Vector3()
    const dampedColor = dampedColorRef.current
    const aimDir = aimDirRef.current
    if (!cur.current) {
      cur.current = { x: slideIn ? offscreenX(pos, viewport) : t.x, y: t.y, z: t.z, scale: t.scale, opacity: 0 }
    }
    // Прогрев: держим шар невидимым, пока компилируются шейдеры/постпроцесс-композер (фриз прячется за
    // opacity 0). Позиционируем и крутим время, но фейд НЕ запускаем — появление выйдет чистым, без рывка.
    if (hold) {
      const c0 = cur.current
      material.color.copy(targetColor)
      dampedColor.copy(targetColor)
      material.opacity = 0
      ring?.setOpacity(0)
      ring?.setColor(targetRingColor)
      tick(dt); ring?.tick(dt)
      const g0 = groupRef.current
      if (g0) { g0.position.x = c0.x; g0.position.y = c0.y; g0.position.z = c0.z; g0.scale.setScalar(c0.scale) }
      return
    }
    const k = 1 - Math.exp(-dt / DAMP_TAU)
    const kf = 1 - Math.exp(-dt / FADE_TAU)
    const kc = 1 - Math.exp(-dt / COLOR_TAU)
    const c = cur.current
    c.x += (targetX - c.x) * k
    c.scale += (t.scale - c.scale) * k
    c.y += (t.y - c.y) * k
    c.z += (t.z - c.z) * k
    c.opacity += (targetOpacity - c.opacity) * kf
    dampedColor.lerp(targetColor, kc)
    if (!fx) material.color.copy(dampedColor)   // без превью цветом владеем сами (как раньше)
    material.opacity = c.opacity
    ring?.setOpacity(c.opacity)
    ring?.lerpColor(targetRingColor, kc)   // кольцо плавно тянется к «второму» цвету (реактивно)
    tick(dt); ring?.tick(dt)
    const g = groupRef.current
    if (g) { g.position.x = c.x; g.position.y = c.y; g.position.z = c.z; g.scale.setScalar(c.scale) }

    // Одноразовое превью заряда по клику: charge → fire → idle (цикл не перезапускается).
    // Звук воспроизводится один раз в useEffect (не здесь). В idle — нейтральный кадр (progress 0, shrink 1).
    if (fx && meshRef.current && g) {
      // Ленивая инициализация frameRef — нужна только при наличии fx.
      if (!frameRef.current) {
        frameRef.current = { progress: 0, shrink: 1, baseColor: dampedColor, aimDir, origin: PREVIEW_ORIGIN, visible: true }
      }
      const cy = cycle.current
      aimDir.copy(camera.position).sub(g.position).normalize()   // базово — «лицом» к зрителю
      if (pos === 'shot-right') aimDir.copy(SHOT_AIM_DIR)   // ВЫСТРЕЛ: фиксированная диагональ вниз-влево
      cy.elapsed += dt * 1000
      if (cy.phase === 'charge' && cy.elapsed >= PREVIEW_CHARGE_MS) {
        cy.phase = 'fire'; cy.elapsed = 0
        // Момент выстрела: луч из центра шара по прицелу (визуализация BeamWeapon — как в матче).
        _beamEnd.copy(aimDir).multiplyScalar(PREVIEW_BEAM_LEN)
        beam?.playBeam(PREVIEW_ORIGIN, _beamEnd)
      }
      else if (cy.phase === 'fire' && cy.elapsed >= PREVIEW_FIRE_MS) { cy.phase = 'idle'; cy.elapsed = 0 }
      // idle остаётся idle — не перезапускается
      const f = frameRef.current
      f.progress = cy.phase === 'charge' ? Math.min(cy.elapsed / PREVIEW_CHARGE_MS, 1) : 0
      f.shrink = cy.phase === 'fire' ? Math.min(cy.elapsed / PREVIEW_FIRE_MS, 1) : 1
      fx.apply(dt, { mesh: meshRef.current, material }, f)
      beam?.update(dt, PREVIEW_BEAM_CTX)   // фаза оружия idle → только рендер луча/афтерглоу
    }

    // Превью респавна: ghost (проезд по кругу) → rebirth → idle. Звук respawn — на старте сборки.
    if (rfx && meshRef.current && g) {
      if (!respawnFrameRef.current) {
        respawnFrameRef.current = { ghost: null, sinceRebirthMs: Number.MAX_SAFE_INTEGER, baseColor: dampedColor, origin: PREVIEW_ORIGIN, visible: true }
      }
      const rc = respawnCycle.current
      const rf = respawnFrameRef.current
      rc.elapsed += dt * 1000
      if (rc.phase === 'ghost' && rc.elapsed >= RESPAWN_PREVIEW_GHOST_MS) {
        rc.phase = 'rebirth'; rc.elapsed = 0
        sfx?.play2D('respawn')
      } else if (rc.phase === 'rebirth' && rc.elapsed >= RESPAWN_PREVIEW_REBIRTH_MS) {
        rc.phase = 'idle'; rc.elapsed = 0
      }
      if (rc.phase === 'ghost') {
        rf.ghost = 1 - rc.elapsed / RESPAWN_PREVIEW_GHOST_MS
        rf.sinceRebirthMs = Number.MAX_SAFE_INTEGER
        // Круговой проезд: группа объезжает свою позицию и возвращается к началу фазы сборки.
        const theta = (rc.elapsed / RESPAWN_PREVIEW_GHOST_MS) * 2 * Math.PI
        g.position.x += Math.sin(theta) * RESPAWN_CIRCLE_R
        g.position.z += (Math.cos(theta) - 1) * RESPAWN_CIRCLE_R
      } else {
        rf.ghost = null
        rf.sinceRebirthMs = rc.phase === 'rebirth' ? rc.elapsed : Number.MAX_SAFE_INTEGER
      }
      rfx.apply(dt, {
        mesh: meshRef.current, material,
        setOpacity: (o: number) => { material.opacity = o; ring?.setOpacity(o) },
      }, rf)
      rfx.update(dt)
    }
  })

  return (
    <group ref={groupRef} scale={0.0001}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS]} />
        <primitive object={material} attach="material" />
        {ring && <primitive object={ring.mesh} />}
      </mesh>
      {fx && <primitive object={fx.object3d} />}
      {beam && <primitive object={beam.object3d} />}
      {rfx && <primitive object={rfx.object3d} />}
    </group>
  )
}

const specOf = (color: string, model?: BallModel, ringColor?: string): BallSpec => ({ color, model: model ?? 'smooth', ringColor })

/** Какие шары активны и куда едут — по текущему режиму/состоянию лобби. Ключ `player` стабилен между экранами. */
function computeBalls(mode: MenuMode, player: BallSpec, lobby: LobbyView | null, appearancePart: AppearancePart): ActiveBall[] {
  if (mode === 'appearance') {
    const pos: Pos = appearancePart === 'shot' ? 'shot-right' : appearancePart === 'respawn' ? 'respawn-far' : 'settings-left'
    return [{ key: 'player', spec: player, pos, slideIn: false }]
  }
  // Дефолт: шар в центре (и при нелобби, и при 'settings' — косметика переехала на экран внешности)
  if (mode !== 'lobby' || !lobby) return [{ key: 'player', spec: player, pos: 'center', slideIn: false }]

  const host = lobby.roster.find(r => r.id === HOST_ID)
  const opp = lobby.roster.find(r => r.id === OPPONENT_ID)
  if (!host) return [{ key: 'player', spec: player, pos: 'center', slideIn: false }]
  if (!opp) return [{ key: 'player', spec: specOf(host.color, host.ballModel, player.ringColor), pos: 'center', slideIn: false }]

  // Двое: хост слева, соперник справа. Свой шар (player) — на своей стороне, другой выезжает.
  // У своего шара кольцо — наш «второй» цвет (player.ringColor); у соперника второго цвета нет → его же цвет.
  const selfIsHost = lobby.localPlayerId === HOST_ID
  const self = selfIsHost ? host : opp
  const other = selfIsHost ? opp : host
  return [
    { key: 'player', spec: specOf(self.color, self.ballModel, player.ringColor), pos: selfIsHost ? 'left-edge' : 'right-edge', slideIn: false },
    { key: 'other', spec: specOf(other.color, other.ballModel), pos: selfIsHost ? 'right-edge' : 'left-edge', slideIn: true },
  ]
}

type RenderedBall = ActiveBall & { exiting?: boolean }

/** Подпись активных шаров — стабильная зависимость эффекта (computeBalls даёт новые объекты каждый рендер). */
function signOf(balls: ActiveBall[]): string {
  return balls.map(b => `${b.key}:${b.spec.color}:${b.spec.ringColor ?? ''}:${b.spec.model}:${b.spec.windupStyle ?? ''}:${b.spec.windupSeq ?? 0}:${b.spec.respawnStyle ?? ''}:${b.spec.respawnSeq ?? 0}:${b.pos}:${b.slideIn ? 1 : 0}`).join('|')
}

function Scene({ mode, player, lobby, appearancePart = 'color', onReady, sfx }: { mode: MenuMode; player: BallSpec; lobby: LobbyView | null; appearancePart?: AppearancePart; onReady?: () => void; sfx?: ISfxEngine }) {
  const active = computeBalls(mode, player, lobby, appearancePart)
  const sign = signOf(active)
  const [rendered, setRendered] = useState<RenderedBall[]>(active)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Прогрев сцены: первые кадры компилируются шейдеры моделей и постпроцесс-композер (фриз). Держим шары
  // невидимыми (hold), пока это не пройдёт, затем разрешаем фейд — появление получается плавным, без рывка.
  const [warm, setWarm] = useState(false)
  const warmFrames = useRef(0)
  const firedReady = useRef(false)
  useFrame(() => {
    if (warmFrames.current >= WARMUP_FRAMES) return
    warmFrames.current += 1
    if (warmFrames.current >= WARMUP_FRAMES) {
      setWarm(true)
      // Контекст создан и несколько кадров отрисовано → можно безопасно перекрыть оверлеем (без гонки init).
      if (!firedReady.current) { firedReady.current = true; onReady?.() }
    }
  })

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
      {rendered.map(b => <AnimatedBall key={b.key} spec={b.spec} pos={b.pos} slideIn={b.slideIn} exiting={b.exiting} hold={!warm} sfx={sfx} />)}
    </>
  )
}

// Контекст React не пересекает границу R3F-Canvas — поэтому движок идёт пропом, а не useSfx().
interface MenuBackdropProps { mode: MenuMode; player: BallSpec; lobby?: LobbyView | null; appearancePart?: AppearancePart; analysis?: AudioAnalysis; glow?: boolean; onReady?: () => void; sfx?: ISfxEngine }

/**
 * Персистентный прозрачный фон меню-экранов: крупная «живая» моделька игрока, резко (но не мгновенно)
 * переезжающая между позициями при смене экрана; в лобби с двумя игроками — два шара по краям.
 * Монтируется на уровне App для всех экранов кроме игры (при возврате из игры — заново → фейд-ин).
 */
export function MenuBackdrop({ mode, player, lobby, appearancePart, analysis, glow = true, onReady, sfx }: MenuBackdropProps) {
  // Тяжёлый glow-композер (Bloom + edge-effect + depth-pass) при первом рендере СИНХРОННО компилирует свои
  // шейдеры — это блокирует главный поток (фриз всего UI) и «съедает» фейд шара. Поэтому монтируем его НЕ на
  // критическом пути входа, а с задержкой: к этому моменту шар уже проявился, а свечение в тишине всё равно 0
  // (музыка только начинает фейдиться) — компиляция проходит незаметно. requestIdleCallback — в свободном слоте.
  const [glowReady, setGlowReady] = useState(false)
  useEffect(() => {
    if (!glow) { setGlowReady(false); return }
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void }
    let idle = 0
    const t = setTimeout(() => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setGlowReady(true))
      else setGlowReady(true)
    }, GLOW_MOUNT_DELAY_MS)
    return () => { clearTimeout(t); if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle) }
  }, [glow])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas gl={{ alpha: true }} dpr={[1, 2]} camera={{ position: [0, 3.02, 5.18], fov: 45 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
        <ambientLight intensity={0.4} />
        <OrbitingLight />
        <Scene mode={mode} player={player} lobby={lobby ?? null} appearancePart={appearancePart} onReady={onReady} sfx={sfx} />
        {/* Свечение ВИДИМЫХ рёбер моделей (принцип как подсветка блоков) → Bloom; в тишине свечения нет.
            Монтируется отложенно (см. выше), чтобы компиляция не морозила вход. Галка настроек — внешний gate. */}
        {glow && glowReady && <MenuEdgeGlow analysis={analysis} />}
      </Canvas>
    </div>
  )
}
