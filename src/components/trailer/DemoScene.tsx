/**
 * Воспроизведение демо на РЕАЛЬНЫХ игровых ресурсах: строим настоящих `Player` из ростера и гоним их
 * клиентским путём рендера (`applyNetState` + `updateRemote` + `cosmeticFire/applyDeath/respawnAt`),
 * камеру ставим из записи (pos+quat+fov, со сглаживанием между 30fps-кадрами). Никакой симуляции/физики —
 * чистый детерминированный реплей. Поддержан подотрезок [from..to] (кадры независимы).
 */
import { useMemo, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Player } from '../../game/Player'
import { Body } from '../../game/Body'
import { BeamWeapon } from '../../game/BeamWeapon'
import { Shield } from '../../game/Shield'
import { World } from '../../game/World'
import { createWindupFx } from '../../game/fx/windup/createWindupFx'
import { createBeamFx } from '../../game/fx/beam/createBeamFx'
import { createRespawnFx } from '../../game/fx/respawn/createRespawnFx'
import { createDashFx } from '../../game/fx/dash/createDashFx'
import { createShieldFx } from '../../game/fx/shield/createShieldFx'
import { decodeBallArt } from '../../game/ballArt'
import { loadProfile } from '../../settings'
import { MAPS, getCachedMapGeo } from '../../game/maps'
import { gridGeometry } from '../../game/grid'
import { compileBlocksCached, buildGeometry } from '../../game/mapGeometryCache'
import { MapLights } from '../MapVisualBits'
import { MapEdges, BLOCK_LAYER } from '../EdgeOutline'
import { fromVec3 } from '../../net/protocol'
import type { MapId, WindupStyle } from '../../constants'
import { BLOCK_TRANSPARENT_OPACITY } from '../../constants'
import type { PlayerSnapshot, RosterEntry } from '../../net/protocol'
import { streakTier, announceKind, announceSfx } from '../../game/streak'
import type { StreakTier } from '../../game/streak'
import type { SfxEvent } from '../../game/audio/sfx/types'
import type { AnnounceItem } from '../../hooks/useGameHUD'
import type { DemoFile, DemoFrame, DemoPlayerState } from '../../game/demo/demoTypes'

// Звук луча = весь выстрел (заряд→разряд), стартует с НАЧАЛА зарядки; вариант по стилю (как в игре).
const BEAM_SFX: Record<WindupStyle, SfxEvent> = {
  classic: 'beam_fire', rage: 'beam_fire_rage', singularity: 'beam_fire_singularity',
}

export interface DemoHud {
  scores: { name: string; kills: number; deaths: number }[]
  matchTimeSec: number
  streaks: Record<number, StreakTier | null>
  streakCounts: Record<number, number>
  beamProgress: number      // готовность луча POV (прицел)
  windupProgress: number    // заряд POV (оверлей зарядки)
  dashProgress: number      // готовность дэша POV
  shieldProgress: number    // готовность щита POV
  shieldVisible: boolean
  respawning: { progress: number } | null   // POV в фазе возрождения → оверлей
}

export interface DemoRange { from: number; to: number }   // диапазон кадров (вкл.)

interface DemoSceneProps {
  demo: DemoFile
  ranges: DemoRange[]       // список коротких фрагментов одного клипа — играем подряд (джамп-каты)
  onHud: (h: DemoHud) => void
  onSfx: (e: SfxEvent) => void
  onAnnounce: (a: AnnounceItem) => void
  onReady?: () => void      // сцена прогрелась и отрисовала кадр (снять ковер-затемнение)
  onNearEnd?: () => void     // монтаж близок к концу (лид для звука перебивки — играть чуть раньше визуала)
  onEnd: () => void
}

const WARMUP_FRAMES = 3     // кадров на компиляцию шейдеров скинов до onReady (чёрный прячем ковером)
const NEAR_END_LEAD_MS = 60    // за сколько до конца монтажа дёрнуть onNearEnd

function buildPlayer(e: RosterEntry, ringColor: string): Player {
  const windupStyle = e.windupStyle ?? 'classic'
  const respawnStyle = e.respawnStyle ?? 'echo'
  const dashStyle = e.dashStyle ?? 'streak'
  const shieldStyle = e.shieldStyle ?? 'dome'
  const ballArt = decodeBallArt(e.ballArt) ?? undefined
  const body = new Body(e.id, e.color, e.ballModel ?? 'smooth', ringColor, ballArt)
  const weapon = e.kind === 'bot'
    ? new BeamWeapon({ outerColor: '#f44' })
    : new BeamWeapon({ outerColor: e.color, beamFx: createBeamFx(windupStyle, e.color) })
  const shield = new Shield({ shieldFx: createShieldFx(shieldStyle) })
  const p = new Player(e.id, body, weapon, shield, e.color,
    createWindupFx(windupStyle), windupStyle,
    createRespawnFx(respawnStyle, e.color), respawnStyle,
    createDashFx(dashStyle, e.color), dashStyle)
  p.name = e.name
  return p
}

function toSnap(ps: DemoPlayerState): PlayerSnapshot {
  return { id: ps.id, pos: ps.pos, aimDir: ps.aimDir, alive: ps.alive, shieldActive: ps.shieldActive, dashing: ps.dashing, windupProgress: ps.windupProgress, respawning: ps.respawning }
}

const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion()
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _pp = new THREE.Vector3()
const lerp = (a: number, b: number, s: number) => a + (b - a) * s

// Диагностика: true → рендерим сцену БЕЗ игроков/FX (только камера+сетка+маркер) для изоляции проблем.
// Оставлено выключенным; при отладке можно временно включить.
const DEBUG_SCENE_ONLY = false

/** Визуал арены БЕЗ физики (Rapier не нужен в реплее): пол + сетка + блоки карты + свет карты. */
function DemoArena({ mapId }: { mapId: MapId }) {
  const map = MAPS[mapId]
  const [hx, hz] = map.half
  const gridGeo = useMemo(() => gridGeometry(hx, hz), [hx, hz])
  useEffect(() => () => gridGeo.dispose(), [gridGeo])
  const compiled = useMemo(() => getCachedMapGeo(map.id) ?? compileBlocksCached(map.id, map.blocks), [map])
  // Визуал блоков (без коллизии — трейлер). 4 группы; прозрачные рисуем полупрозрачным материалом.
  const blockGeos = useMemo(() => [
    { g: compiled.opaqueRaycast, transp: false }, { g: compiled.opaqueNoRaycast, transp: false },
    { g: compiled.transparentRaycast, transp: true }, { g: compiled.transparentNoRaycast, transp: true },
  ].map(x => ({ geo: x.g ? buildGeometry(x.g) : null, transp: x.transp })), [compiled])
  useEffect(() => () => blockGeos.forEach(x => x.geo?.dispose()), [blockGeos])
  return (
    <>
      <MapLights half={map.half} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ noRaycast: true }}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={map.floorColor} />
      </mesh>
      <lineSegments geometry={gridGeo} position={[0, 0.01, 0]}>
        <lineBasicMaterial color="#555" />
      </lineSegments>
      {blockGeos.map((x, i) => x.geo && (
        <mesh key={i} geometry={x.geo} castShadow receiveShadow userData={{ block: true }} onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
          <meshStandardMaterial vertexColors transparent={x.transp} opacity={x.transp ? BLOCK_TRANSPARENT_OPACITY : 1} depthWrite={!x.transp} />
        </mesh>
      ))}
    </>
  )
}

export function DemoScene({ demo, ranges, onHud, onSfx, onAnnounce, onReady, onNearEnd, onEnd }: DemoSceneProps) {
  const camera = useThree(s => s.camera)
  const styleById = useMemo(() => new Map(demo.roster.map(r => [r.id, r.windupStyle ?? 'classic'])), [demo])
  // Предыдущие флаги игроков (для звуков по переходам: зарядка/дэш/щит).
  const prevFlags = useRef<Map<number, { w: number; d: boolean; s: boolean }>>(new Map())
  const scene = useThree(s => s.scene)

  const world = useMemo(() => new World(scene), [scene])
  // Игроков создаём и уничтожаем в ОДНОМ эффекте — иначе StrictMode (dev) dispose'ит их при двойном
  // монтировании, а useMemo возвращает те же (уже уничтоженные) объекты → меши не рисуются.
  const [players, setPlayers] = useState<Player[]>([])
  useEffect(() => {
    // Кольцо планеты: у локального игрока — «второй» цвет (reserveColor из демо, иначе из профиля),
    // у соперника — его же цвет (как в игре).
    const reserve = demo.reserveColor ?? loadProfile().reserveColor
    const ps = demo.roster.map(e => buildPlayer(e, e.id === demo.localId ? (reserve ?? e.color) : e.color))
    setPlayers(ps)
    return () => ps.forEach(p => p.dispose())
  }, [demo])
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players])

  const rangeIdx = useRef(0)
  const clockMs = useRef(demo.frames[ranges[0].from]?.tMs ?? 0)
  const firedTo = useRef(ranges[0].from - 1)   // индекс последнего кадра текущего диапазона, чьи события сыграны
  const lastHudIdx = useRef(-1)
  const ended = useRef(false)
  const warm = useRef(0)
  const readyFired = useRef(false)
  const nearEndFired = useRef(false)

  // На старте — мгновенно расставить игроков по первому кадру первого диапазона.
  useEffect(() => {
    const f = demo.frames[ranges[0].from]
    if (f) for (const ps of f.players) byId.get(ps.id)?.applyNetState(toSnap(ps))
    rangeIdx.current = 0
    clockMs.current = demo.frames[ranges[0].from]?.tMs ?? 0
    firedTo.current = ranges[0].from - 1
    lastHudIdx.current = -1; ended.current = false; warm.current = 0; readyFired.current = false
    nearEndFired.current = false
    seedFlags(prevFlags.current, f)   // не «перевыстреливать» зарядку, уже идущую на старте фрагмента
  }, [demo, ranges, byId])

  useFrame((_, dtRaw) => {
    if (ended.current) return
    // Прогрев: после WARMUP_FRAMES отрисованных кадров — onReady (снять ковер-затемнение).
    if (!readyFired.current && players.length) {
      warm.current++
      if (warm.current >= WARMUP_FRAMES) { readyFired.current = true; onReady?.() }
    }
    const dt = Math.min(dtRaw, 0.05)
    clockMs.current += dt * 1000
    const tMs = clockMs.current

    // текущий кадр в пределах активного диапазона [r.from..r.to]
    const r = ranges[rangeIdx.current]
    let i = r.from
    while (i < r.to && demo.frames[i + 1].tMs <= tMs) i++
    const cur = demo.frames[i]
    const nxt = demo.frames[Math.min(i + 1, r.to)]
    const span = Math.max(1, nxt.tMs - cur.tMs)
    const s = Math.max(0, Math.min(1, (tMs - cur.tMs) / span))

    // Позы игроков: флаги/прицел — из cur (applyNetState), позицию ведём НАПРЯМУЮ (без Rapier),
    // интерполируя cur→nxt для плавности; bodyGroup позиционируем сами (в игре это делает RigidBody).
    if (!DEBUG_SCENE_ONLY) {
      for (const ps of cur.players) {
        const p = byId.get(ps.id); if (!p) continue
        p.applyNetState(toSnap(ps))
        p.setBodyVisible(ps.bodyVisible)
        const n = nxt.players.find(q => q.id === ps.id) ?? ps
        _pp.set(lerp(ps.pos[0], n.pos[0], s), lerp(ps.pos[1], n.pos[1], s), lerp(ps.pos[2], n.pos[2], s))
        p.setReplayPose(_pp)
        // Звуки по переходам флагов: луч — с НАЧАЛА зарядки (вариант по стилю), дэш, щит вкл/выкл.
        const pf = prevFlags.current.get(ps.id) ?? { w: 0, d: false, s: false }
        if (pf.w <= 0.02 && ps.windupProgress > 0.02) onSfx(BEAM_SFX[styleById.get(ps.id) ?? 'classic'])
        if (!pf.d && ps.dashing) onSfx('dash')
        if (!pf.s && ps.shieldActive) onSfx('shield_up')
        if (pf.s && !ps.shieldActive) onSfx('shield_down')
        prevFlags.current.set(ps.id, { w: ps.windupProgress, d: ps.dashing, s: ps.shieldActive })
      }
      for (const p of players) p.updateRemote(dt, world)
    }

    // камера — интерполяция между cur и nxt
    _p0.fromArray(cur.cam.p); _p1.fromArray(nxt.cam.p)
    camera.position.lerpVectors(_p0, _p1, s)
    _q0.set(cur.cam.q[0], cur.cam.q[1], cur.cam.q[2], cur.cam.q[3])
    _q1.set(nxt.cam.q[0], nxt.cam.q[1], nxt.cam.q[2], nxt.cam.q[3])
    camera.quaternion.copy(_q0.slerp(_q1, s))
    const cam = camera as THREE.PerspectiveCamera
    const fov = cur.cam.fov + (nxt.cam.fov - cur.cam.fov) * s
    if (cam.isPerspectiveCamera && Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix() }

    // HUD — на смене кадра (≤30/сек)
    if (lastHudIdx.current !== i) { lastHudIdx.current = i; onHud(hudOf(cur, demo)) }

    // транзиентные FX кадров текущего диапазона
    while (firedTo.current < i) {
      firedTo.current++
      applyFrameEvents(demo.frames[firedTo.current], byId, onSfx, onAnnounce, demo.roster)
    }

    // лид-сигнал близкого конца монтажа: звук перебивки дёргаем чуть раньше визуала (синхрон удара)
    if (!nearEndFired.current && rangeIdx.current === ranges.length - 1
        && tMs >= demo.frames[r.to].tMs - NEAR_END_LEAD_MS) {
      nearEndFired.current = true; onNearEnd?.()
    }

    // конец диапазона → следующий фрагмент (джамп-кат) или завершение шота
    if (tMs >= demo.frames[r.to].tMs) {
      if (rangeIdx.current < ranges.length - 1) {
        rangeIdx.current++
        const nr = ranges[rangeIdx.current]
        clockMs.current = demo.frames[nr.from].tMs
        firedTo.current = nr.from - 1
        lastHudIdx.current = -1
        seedFlags(prevFlags.current, demo.frames[nr.from])   // не триггерить звуки на стыке фрагментов
      } else {
        ended.current = true; onEnd()
      }
    }
  })

  return (
    <>
      <DemoArena mapId={demo.mapId} />
      {!DEBUG_SCENE_ONLY && players.map(p => (
        <group key={p.id}>
          <primitive object={p.bodyGroup} />
          <primitive object={p.weaponObject} />
          <primitive object={p.trailObject} />
          <primitive object={p.respawnFxObject} />
          <primitive object={p.windupFxObject} />
        </group>
      ))}
      {/* Игровая пост-обработка: неон-контур рёбер укрытий (как в матче). */}
      <MapEdges />
    </>
  )
}

type FlagState = { w: number; d: boolean; s: boolean }

/**
 * Засеять prevFlags значениями кадра `f`: при склейке фрагментов уже идущая зарядка/дэш/щит считаются
 * «известными», и звук-переход (0→зарядка и т.п.) на первом кадре фрагмента НЕ срабатывает ложно.
 */
function seedFlags(map: Map<number, FlagState>, f: DemoFrame | undefined) {
  map.clear()
  if (!f) return
  for (const ps of f.players) map.set(ps.id, { w: ps.windupProgress, d: ps.dashing, s: ps.shieldActive })
}

function applyFrameEvents(
  f: DemoFrame, byId: Map<number, Player>,
  onSfx: (e: SfxEvent) => void, onAnnounce: (a: AnnounceItem) => void, roster: RosterEntry[],
) {
  for (const e of f.events) {
    switch (e.t) {
      case 'fired':
        byId.get(e.id)?.cosmeticFire(fromVec3(e.end), e.hitPoint ? fromVec3(e.hitPoint) : null)
        break   // звук луча — из перехода зарядки (см. выше), не здесь
      case 'kill': {
        byId.get(e.victim)?.applyDeath()
        onSfx('death')
        const kind = announceKind(e.streak, e.firstBlood)   // серия (CATALYST/DOUBLE/…)
        if (kind) {
          onSfx(announceSfx(kind))
          const r = roster.find(x => x.id === e.shooter)
          onAnnounce({ name: r?.name ?? '', color: r?.color ?? '#4af', kind })   // баннер серии
        }
        break
      }
      case 'block':
        onSfx('block')
        break
      case 'respawn':
        byId.get(e.id)?.respawnAt(fromVec3(e.pos))
        onSfx('respawn')
        break
      // move/scores/time — состояние берём из абсолютных полей кадра (frame-independent)
    }
  }
}

function hudOf(f: DemoFrame, demo: DemoFile): DemoHud {
  const nameOf = (id: number) => demo.roster.find(r => r.id === id)?.name ?? ''
  const streaks: Record<number, StreakTier | null> = {}
  const streakCounts: Record<number, number> = {}
  for (const p of f.players) { streaks[p.id] = p.streakCount > 0 ? streakTier(p.streakCount) : null; streakCounts[p.id] = p.streakCount }
  const pov = f.players.find(p => p.id === demo.localId)
  return {
    scores: f.players.map(p => ({ name: nameOf(p.id), kills: p.kills, deaths: p.deaths })),
    matchTimeSec: Math.ceil(f.remainingMs / 1000),
    streaks,
    streakCounts,
    beamProgress: pov?.beamCooldown ?? 1,
    windupProgress: pov?.windupProgress ?? 0,
    dashProgress: pov?.dashCooldown ?? 1,
    shieldProgress: pov?.shieldProgress ?? 0,
    shieldVisible: pov?.shieldActive ?? false,
    respawning: pov?.respawning ? { progress: pov.respawnProgress ?? 0 } : null,
  }
}
