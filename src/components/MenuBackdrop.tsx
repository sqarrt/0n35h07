import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BALL_RADIUS, BODY_MESH_Y, PREVIEW_SPIN_SPEED, HOST_ID, OPPONENT_ID, MENU_ANIM_TAU, BEAM_WINDUP, WINDUP_SHRINK_MS } from '../constants'
import type { BallModel, WindupStyle, RespawnStyle } from '../constants'
import type { LobbyView } from '../net/LobbySession'
import { PLAYER_SPOT, OPPONENT_SPOT, cameraStateFor } from './menuStage'
import type { MenuMode, AppearancePart, MenuCameraState, CameraPoses, CameraPose } from './menuStage'
import rawPoses from './menuCameraPoses.json'
import { Body } from '../game/Body'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'
import { MenuEdgeGlow, MENU_GLOW_LAYER } from './MenuEdgeGlow'
import { createWindupFx } from '../game/fx/windup/createWindupFx'
import { BeamWeapon } from '../game/BeamWeapon'
import { createBeamFx } from '../game/fx/beam/createBeamFx'
import { createRespawnFx } from '../game/fx/respawn/createRespawnFx'
import { AfterimageTrail } from '../game/fx/AfterimageTrail'
import type { WeaponContext } from '../game/abstractions'
import type { World } from '../game/World'
import { windupSfxEvent } from '../game/audio/sfx/windupSfx'
import type { ISfxEngine } from '../game/audio/sfx/types'

export type { MenuMode } from './menuStage'

// Анимация камеры/появления модельки.
const DAMP_TAU = MENU_ANIM_TAU // переезд камеры — общий TAU с подложкой меню (одинаковая скорость)
const FADE_TAU = 0.13          // появление модели (opacity) — мягкий фейд (~0.4с)
const COLOR_TAU = 0.067        // плавная смена цвета модельки (~0.2с до 95%)
const EXIT_MS = 400            // сколько держим уходящий шар смонтированным, пока он гаснет
const WARMUP_FRAMES = 4        // кадров прогрева (компиляция шейдеров за невидимым шаром) до старта фейда
const GLOW_MOUNT_DELAY_MS = 600 // отложенный монтаж glow-композера (см. комментарий в MenuBackdrop)

// Превью анимации заряда — на экране внешности: одноразовый прогон по клику (charge → fire → idle).
const PREVIEW_CHARGE_MS = BEAM_WINDUP        // зарядка — как у игрока
const PREVIEW_FIRE_MS = WINDUP_SHRINK_MS     // «сдувание» после выстрела
const PREVIEW_BEAM_LEN = BALL_RADIUS * 16    // длина луча выстрела превью (мировые единицы)
const PREVIEW_ENTITY_ID = -1                 // entityId превью-Body (его хитбокс в боёвке не участвует)
// Косметический контекст для BeamWeapon превью: фаза оружия всегда idle → fire()/raycast не вызываются.
const PREVIEW_BEAM_CTX: WeaponContext = {
  world: { raycast: () => null } as unknown as World,
  muzzle: new THREE.Vector3(), aim: new THREE.Vector3(0, 0, -1), excludeIds: [],
}

// Блок ВЫСТРЕЛ: прицел фиксированный — по диагонали (модель разворачивается faceDir'ом как в игре).
const SHOT_AIM_DIR = new THREE.Vector3(-0.78, -0.55, 1.3).normalize()

// Превью респавна: один прогон по клику — смерть → призрак (пробежка по кругу) → возрождение.
const RESPAWN_PREVIEW_GHOST_MS = 1200
const RESPAWN_PREVIEW_REBIRTH_MS = 500
const RESPAWN_CIRCLE_R = 2.6     // радиус пробежки призрака (мировые единицы — «играем за бота»)

// Полёт камеры (dev, зажатая J): мышь — осмотр, колёсико — вперёд/назад. На отпускание поза пишется в файл.
const FLY_KEY = 'KeyJ'
const FLY_LOOK_SENS = 0.0032     // рад на пиксель мыши
const FLY_WHEEL_STEP = 0.0012    // ед. на единицу deltaY колёсика
const FLY_TARGET_DIST = 4        // дистанция до сохраняемой точки взгляда (по лучу камеры)
const POSES_ENDPOINT = '/__camera-poses'

// Scratch-объекты кадра (без аллокаций).
const _beamEnd = new THREE.Vector3()
const _meshCenter = new THREE.Vector3()
const _camPosT = new THREE.Vector3()
const _camLookT = new THREE.Vector3()
const _flyDir = new THREE.Vector3()
const _tangent = new THREE.Vector3()

// Позы камеры: модуль-копия из JSON; правки полётом (J) пишутся сюда и в файл через dev-эндпоинт.
const poses: CameraPoses = JSON.parse(JSON.stringify(rawPoses)) as CameraPoses
// Полёт активен → CameraRig не трогает камеру. Модульный флаг — FlyCam и CameraRig живут в одном Canvas.
const flying = { current: false }

// ringColor — «второй» цвет (кольцо планеты); *Seq — счётчики кликов (триггеры одноразовых превью).
interface BallSpec { color: string; model: BallModel; ringColor?: string; windupStyle?: WindupStyle; windupSeq?: number; respawnStyle?: RespawnStyle; respawnSeq?: number }
interface ActiveBall { key: string; spec: BallSpec; spot: THREE.Vector3 }

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

/** Риг камеры: демпфированный переезд между сохранёнными позами состояний. Пока активен полёт (J) — молчит. */
function CameraRig({ state }: { state: MenuCameraState }) {
  const camera = useThree(s => s.camera)
  const cur = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const pose: CameraPose = poses[state]
    if (!cur.current) {
      cur.current = { pos: new THREE.Vector3().fromArray(pose.position), look: new THREE.Vector3().fromArray(pose.target) }
    }
    const c = cur.current
    if (flying.current) {   // полёт: камеру ведёт пользователь; риг догонит после сохранения позы
      c.pos.copy(camera.position)
      camera.getWorldDirection(_flyDir)
      c.look.copy(camera.position).addScaledVector(_flyDir, FLY_TARGET_DIST)
      return
    }
    _camPosT.fromArray(pose.position)
    _camLookT.fromArray(pose.target)
    const k = 1 - Math.exp(-dt / DAMP_TAU)
    c.pos.lerp(_camPosT, k)
    c.look.lerp(_camLookT, k)
    camera.position.copy(c.pos)
    camera.lookAt(c.look)
  })
  return null
}

/** Dev-полёт камеры: зажал J — мышь осматривается, колёсико едет вперёд/назад; отпустил —
 *  поза текущего состояния сохраняется в menuCameraPoses.json (vite-plugin-camera-poses).
 *  Подписка ОДНОРАЗОВАЯ (state — через ref): пере-подписка на смену состояния обрывала зажатие J. */
function FlyCam({ state }: { state: MenuCameraState }) {
  const camera = useThree(s => s.camera)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    const dir = new THREE.Vector3()
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === FLY_KEY && !e.repeat) flying.current = true }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== FLY_KEY) return
      flying.current = false
      // Сохранить позу текущего состояния: позиция + точка взгляда по лучу камеры.
      camera.getWorldDirection(dir)
      poses[stateRef.current] = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [
          camera.position.x + dir.x * FLY_TARGET_DIST,
          camera.position.y + dir.y * FLY_TARGET_DIST,
          camera.position.z + dir.z * FLY_TARGET_DIST,
        ],
      }
      void fetch(POSES_ENDPOINT, { method: 'PUT', body: JSON.stringify(poses, null, 2) })
        .catch(() => { /* dev-эндпоинт недоступен (прод) — поза остаётся только в памяти */ })
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!flying.current) return
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= e.movementX * FLY_LOOK_SENS
      euler.x -= e.movementY * FLY_LOOK_SENS
      euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x))
      camera.quaternion.setFromEuler(euler)
    }
    const onWheel = (e: WheelEvent) => {
      if (!flying.current) return
      camera.getWorldDirection(dir)
      camera.position.addScaledVector(dir, -e.deltaY * FLY_WHEEL_STEP)
    }
    const onBlur = () => { flying.current = false }   // потеря фокуса окна — keyup мог не дойти
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('blur', onBlur)
    return () => {
      flying.current = false
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', onBlur)
    }
  }, [camera])
  return null
}

/**
 * Игрок на сцене фона меню: НАСТОЯЩИЙ игровой Body в натуральную величину, стоит на своей точке.
 * Никаких ручных перемещений/масштабов — кадр строит камера (CameraRig). Исключение по правилам:
 * превью респавна «играет за модельку» (пробежка призрака по кругу). Появление/уход — фейд.
 */
function StageBall({ spec, spot, exiting = false, hold = false, sfx, part = 'color' }: { spec: BallSpec; spot: THREE.Vector3; exiting?: boolean; hold?: boolean; sfx?: ISfxEngine; part?: AppearancePart }) {
  const rootRef = useRef<THREE.Group>(null)
  // Реальный игровой Body (меш + кольцо + faceDir): пересоздаём только по модели, цвета лерпаются в кадре.
  const body = useMemo(() => {
    const b = new Body(PREVIEW_ENTITY_ID, spec.color, spec.model, spec.ringColor ?? spec.color)
    b.material.opacity = 0   // без вспышки до первого кадра
    b.object3d.position.copy(spot)
    return b
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.model])
  useEffect(() => () => body.dispose(), [body])
  // Модель — на слой свечения (depth-пасс MenuEdgeGlow); кольцу включаем depthWrite для обводки.
  useEffect(() => {
    rootRef.current?.traverse(o => o.layers.enable(MENU_GLOW_LAYER))
    const ringMesh = body.ringMesh
    if (ringMesh) (ringMesh.material as { depthWrite: boolean }).depthWrite = true
  }, [body])

  const isPreview = part !== undefined && spot === PLAYER_SPOT   // превью-циклы — только у своего шара
  const fx = useMemo(() => (isPreview && spec.windupStyle ? createWindupFx(spec.windupStyle) : null),
    [isPreview, spec.windupStyle])
  useEffect(() => () => fx?.dispose(), [fx])
  // Луч выстрела превью — тот же BeamWeapon, что в матче (косметический playBeam), со стилевым визуалом.
  const beam = useMemo(() => (isPreview ? new BeamWeapon({ beamFx: createBeamFx(spec.windupStyle ?? 'classic', spec.color) }) : null),
    [isPreview, spec.color, spec.windupStyle])
  useEffect(() => () => beam?.dispose(), [beam])
  const cycle = useRef({ phase: 'idle' as 'charge' | 'fire' | 'idle', elapsed: 0 })
  // Счётчики кликов превью монотонные и живут в App: реагируем только на их ИЗМЕНЕНИЯ после монтирования.
  const lastSeqRef = useRef(spec.windupSeq ?? 0)
  useEffect(() => {
    if (!fx) { if (spec.windupSeq !== undefined) lastSeqRef.current = spec.windupSeq; return }
    const seq = spec.windupSeq ?? 0
    if (seq !== 0 && seq !== lastSeqRef.current) {
      lastSeqRef.current = seq
      cycle.current = { phase: 'charge', elapsed: 0 }   // одноразовый прогон: charge → fire → idle
      sfx?.play2D(windupSfxEvent(spec.windupStyle, sfx))   // звук стиля — один раз на старте заряда
    } else {
      cycle.current = { phase: 'idle', elapsed: 0 }
    }
  }, [fx, spec.windupSeq, spec.windupStyle, sfx])

  // Превью респавна — стратегия по стилю; одноразовый прогон по клику (паттерн как у выстрела).
  const rfx = useMemo(() => (isPreview ? createRespawnFx(spec.respawnStyle ?? 'echo', spec.color) : null),
    [isPreview, spec.respawnStyle, spec.color])
  useEffect(() => () => rfx?.dispose(), [rfx])
  const respawnCycle = useRef({ phase: 'idle' as 'ghost' | 'rebirth' | 'idle', elapsed: 0 })
  const lastRespawnSeqRef = useRef(spec.respawnSeq ?? 0)
  useEffect(() => {
    if (!rfx) { if (spec.respawnSeq !== undefined) lastRespawnSeqRef.current = spec.respawnSeq; return }
    const seq = spec.respawnSeq ?? 0
    if (seq !== 0 && seq !== lastRespawnSeqRef.current) {
      lastRespawnSeqRef.current = seq
      respawnCycle.current = { phase: 'ghost', elapsed: 0 }
      _meshCenter.copy(spot).y += BODY_MESH_Y
      rfx.onDeath(_meshCenter)                           // рассыпание/хлопок из центра шара
      sfx?.play2D('death')
    } else {
      respawnCycle.current = { phase: 'idle', elapsed: 0 }
    }
  }, [rfx, spec.respawnSeq, spec.respawnStyle, sfx, spot])
  const respawnFrameRef = useRef<{ ghost: number | null; sinceRebirthMs: number; baseColor: THREE.Color; origin: THREE.Vector3; visible: boolean } | null>(null)
  // След призрака (как в матче — AfterimageTrail у Player; рой рисует свой и общий отключает).
  const trail = useMemo(() => (isPreview ? new AfterimageTrail(new THREE.Color(spec.color)) : null),
    [isPreview, spec.color])
  useEffect(() => () => trail?.dispose(), [trail])

  const dampedColorRef = useRef<THREE.Color | null>(null)
  const aimDirRef = useRef<THREE.Vector3 | null>(null)
  const frameRef = useRef<{ progress: number; shrink: number; baseColor: THREE.Color; aimDir: THREE.Vector3; origin: THREE.Vector3; visible: boolean } | null>(null)
  const opacityRef = useRef(0)
  const camera = useThree(s => s.camera)

  const targetColor = useMemo(() => new THREE.Color(spec.color), [spec.color])
  const targetRingColor = useMemo(() => new THREE.Color(spec.ringColor ?? spec.color), [spec.ringColor, spec.color])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    // Ленивая инициализация мутабельных вспомогательных объектов — за пределами рендера.
    if (!dampedColorRef.current) dampedColorRef.current = new THREE.Color(spec.color)
    if (!aimDirRef.current) aimDirRef.current = new THREE.Vector3()
    const dampedColor = dampedColorRef.current
    const aimDir = aimDirRef.current

    // Прогрев: модель невидима, пока компилируются шейдеры (фриз прячется за opacity 0).
    if (hold) {
      body.material.color.copy(targetColor)
      dampedColor.copy(targetColor)
      body.setOpacity(0)
      body.setRingColor(targetRingColor)
      body.tickShader(dt)
      return
    }
    const kf = 1 - Math.exp(-dt / FADE_TAU)
    const kc = 1 - Math.exp(-dt / COLOR_TAU)
    opacityRef.current += ((exiting ? 0 : 1) - opacityRef.current) * kf
    dampedColor.lerp(targetColor, kc)
    if (!fx) body.material.color.copy(dampedColor)   // без превью цветом владеем сами
    body.setOpacity(opacityRef.current)
    body.lerpRingColor(targetRingColor, kc)
    body.tickShader(dt)

    // Позиция: модель стоит на точке; в призраке превью — пробежка по кругу («играем за бота»).
    // САНКЦИОНИРОВАННОЕ ручное действие: по завершении пробежки шар СТАВИТСЯ на дефолтную точку
    // (copy(spot) каждый кадр) — бег не обязан идеально замкнуть круг, возрождение всегда на месте.
    const rc = respawnCycle.current
    body.object3d.position.copy(spot)
    let ghostRun = false
    if (rfx && rc.phase === 'ghost') {
      // theta ограничен полным кругом: рваный кадр в конце фазы не перебегает за точку старта.
      const theta = Math.min(rc.elapsed / RESPAWN_PREVIEW_GHOST_MS, 1) * 2 * Math.PI
      body.object3d.position.x += Math.sin(theta) * RESPAWN_CIRCLE_R
      body.object3d.position.z += (Math.cos(theta) - 1) * RESPAWN_CIRCLE_R
      // Бежит «мордой вперёд» — по касательной круга.
      _tangent.set(Math.cos(theta), 0, -Math.sin(theta))
      body.faceDir(_tangent)
      ghostRun = true
    }
    if (!ghostRun) {
      aimDir.copy(camera.position).sub(body.object3d.position).normalize()   // базово — «лицом» к зрителю
      if (isPreview && part === 'shot') aimDir.copy(SHOT_AIM_DIR)            // ВЫСТРЕЛ: фиксированная диагональ
      body.faceDir(aimDir)
    }
    _meshCenter.copy(body.object3d.position).y += BODY_MESH_Y   // центр сферы (мир)

    // Одноразовое превью заряда по клику: charge → fire → idle.
    if (fx) {
      if (!frameRef.current) {
        frameRef.current = { progress: 0, shrink: 1, baseColor: dampedColor, aimDir, origin: new THREE.Vector3(), visible: true }
      }
      const cy = cycle.current
      cy.elapsed += dt * 1000
      if (cy.phase === 'charge' && cy.elapsed >= PREVIEW_CHARGE_MS) {
        cy.phase = 'fire'; cy.elapsed = 0
        // Момент выстрела: луч из центра шара по прицелу (визуализация BeamWeapon — как в матче).
        _beamEnd.copy(_meshCenter).addScaledVector(aimDir, PREVIEW_BEAM_LEN)
        beam?.playBeam(_meshCenter, _beamEnd)
      }
      else if (cy.phase === 'fire' && cy.elapsed >= PREVIEW_FIRE_MS) { cy.phase = 'idle'; cy.elapsed = 0 }
      const f = frameRef.current
      f.progress = cy.phase === 'charge' ? Math.min(cy.elapsed / PREVIEW_CHARGE_MS, 1) : 0
      f.shrink = cy.phase === 'fire' ? Math.min(cy.elapsed / PREVIEW_FIRE_MS, 1) : 1
      f.aimDir.copy(aimDir)
      f.origin.copy(_meshCenter)
      fx.apply(dt, { mesh: body.mesh, material: body.material }, f)
      beam?.update(dt, PREVIEW_BEAM_CTX)   // фаза оружия idle → только рендер луча/афтерглоу
    }

    // Превью респавна: ghost (пробежка) → rebirth → idle. Звук respawn — на старте сборки.
    if (rfx) {
      if (!respawnFrameRef.current) {
        respawnFrameRef.current = { ghost: null, sinceRebirthMs: Number.MAX_SAFE_INTEGER, baseColor: dampedColor, origin: new THREE.Vector3(), visible: true }
      }
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
      } else {
        rf.ghost = null
        rf.sinceRebirthMs = rc.phase === 'rebirth' ? rc.elapsed : Number.MAX_SAFE_INTEGER
      }
      rf.origin.copy(_meshCenter)   // рой кружит вокруг бегущего шара
      rfx.apply(dt, {
        mesh: body.mesh, material: body.material,
        setOpacity: (o: number) => body.setOpacity(o),
      }, rf)
      rfx.update(dt)
      // След призрака — как в матче: позиция ГЛАЗ (Body.position эквивалент — позиция сущности).
      trail?.update(dt, { position: body.object3d.position, dashing: rc.phase === 'ghost' && !rfx.ownGhostTrail })
    }
  })

  return (
    <group ref={rootRef}>
      <primitive object={body.object3d} />
      {fx && <primitive object={fx.object3d} />}
      {beam && <primitive object={beam.object3d} />}
      {rfx && <primitive object={rfx.object3d} />}
      {trail && <primitive object={trail.object3d} />}
    </group>
  )
}

const specOf = (color: string, model?: BallModel, ringColor?: string): BallSpec => ({ color, model: model ?? 'smooth', ringColor })

/** Кто стоит на сцене: свой игрок — всегда на своей точке; в лобби при сопернике — второй на соседней. */
function computeBalls(mode: MenuMode, player: BallSpec, lobby: LobbyView | null): ActiveBall[] {
  if (mode === 'lobby' && lobby) {
    const host = lobby.roster.find(r => r.id === HOST_ID)
    const opp = lobby.roster.find(r => r.id === OPPONENT_ID)
    if (host && opp) {
      const selfIsHost = lobby.localPlayerId === HOST_ID
      const self = selfIsHost ? host : opp
      const other = selfIsHost ? opp : host
      return [
        { key: 'player', spec: specOf(self.color, self.ballModel, player.ringColor), spot: PLAYER_SPOT },
        { key: 'other', spec: specOf(other.color, other.ballModel), spot: OPPONENT_SPOT },
      ]
    }
    if (host) return [{ key: 'player', spec: specOf(host.color, host.ballModel, player.ringColor), spot: PLAYER_SPOT }]
  }
  return [{ key: 'player', spec: player, spot: PLAYER_SPOT }]
}

type RenderedBall = ActiveBall & { exiting?: boolean }

/** Подпись активных шаров — стабильная зависимость эффекта (computeBalls даёт новые объекты каждый рендер). */
function signOf(balls: ActiveBall[]): string {
  return balls.map(b => `${b.key}:${b.spec.color}:${b.spec.ringColor ?? ''}:${b.spec.model}:${b.spec.windupStyle ?? ''}:${b.spec.windupSeq ?? 0}:${b.spec.respawnStyle ?? ''}:${b.spec.respawnSeq ?? 0}`).join('|')
}

function Scene({ mode, player, lobby, appearancePart = 'color', onReady, sfx }: { mode: MenuMode; player: BallSpec; lobby: LobbyView | null; appearancePart?: AppearancePart; onReady?: () => void; sfx?: ISfxEngine }) {
  const active = computeBalls(mode, player, lobby)
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
        next.push({ ...b, exiting: true })                       // пропал → держим, пока гаснет (фейд)
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
      {rendered.map(b => <StageBall key={b.key} spec={b.spec} spot={b.spot} exiting={b.exiting} hold={!warm} sfx={sfx} part={appearancePart} />)}
    </>
  )
}

// Контекст React не пересекает границу R3F-Canvas — поэтому движок идёт пропом, а не useSfx().
interface MenuBackdropProps { mode: MenuMode; player: BallSpec; lobby?: LobbyView | null; appearancePart?: AppearancePart; analysis?: AudioAnalysis; glow?: boolean; onReady?: () => void; sfx?: ISfxEngine }

/**
 * Персистентный прозрачный фон меню-экранов: настоящая сцена с игроком (Body в натуральную величину,
 * стоит на точке; в лобби — двое). Кадр строит ТОЛЬКО камера (CameraRig, позы из menuCameraPoses.json);
 * единственное «игровое» движение — пробежка призрака в превью респавна. Dev: пол-сетка + полёт по J.
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

  const hasOpponent = !!lobby?.roster.find(r => r.id === OPPONENT_ID)
  const camState = cameraStateFor(mode, hasOpponent, appearancePart ?? 'color')

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas gl={{ alpha: true }} dpr={[1, 2]} camera={{ position: poses.default.position, fov: 45 }}
        onCreated={({ camera }) => camera.lookAt(...poses.default.target)}>
        <ambientLight intensity={0.4} />
        <OrbitingLight />
        <CameraRig state={camState} />
        {import.meta.env.DEV && <FlyCam state={camState} />}
        {/* Отладочный пол: видно, что модели стоят на сцене и двигается только камера. Dev-only. */}
        {import.meta.env.DEV && <gridHelper args={[24, 24, '#2a3550', '#141d33']} />}
        <Scene mode={mode} player={player} lobby={lobby ?? null} appearancePart={appearancePart} onReady={onReady} sfx={sfx} />
        {/* Свечение ВИДИМЫХ рёбер моделей (принцип как подсветка блоков) → Bloom; в тишине свечения нет.
            Монтируется отложенно (см. выше), чтобы компиляция не морозила вход. Галка настроек — внешний gate. */}
        {glow && glowReady && <MenuEdgeGlow analysis={analysis} />}
      </Canvas>
    </div>
  )
}
