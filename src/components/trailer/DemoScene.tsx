/**
 * Demo playback on REAL game assets: build actual `Player` instances from the roster and run them
 * through the client render path (`applyNetState` + `updateRemote` + `cosmeticFire/applyDeath/respawnAt`),
 * setting the camera from the recording (pos+quat+fov, smoothed between 30fps frames). No simulation/physics —
 * pure deterministic replay. Subrange [from..to] is supported (frames are independent).
 */
import { useMemo, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Player } from '../../game/Player'
import { Body, emptyBodyState } from '../../game/Body'
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

// Beam sound = the whole shot (charge→discharge), starts at the BEGINNING of windup; variant by style (as in game).
const BEAM_SFX: Record<WindupStyle, SfxEvent> = {
  classic: 'beam_fire', rage: 'beam_fire_rage', singularity: 'beam_fire_singularity',
}

export interface DemoHud {
  scores: { id: number; name: string; kills: number; deaths: number; team: number }[]
  matchTimeSec: number
  streaks: Record<number, StreakTier | null>
  streakCounts: Record<number, number>
  beamProgress: number      // POV beam readiness (reticle)
  windupProgress: number    // POV windup (charge overlay)
  dashProgress: number      // POV dash readiness
  shieldProgress: number    // POV shield readiness
  shieldVisible: boolean
  respawning: { progress: number } | null   // POV in respawn phase → overlay
}

export interface DemoRange { from: number; to: number }   // frame range (inclusive)

interface DemoSceneProps {
  demo: DemoFile
  ranges: DemoRange[]       // list of short fragments of one clip — played back-to-back (jump cuts)
  onHud: (h: DemoHud) => void
  onSfx: (e: SfxEvent) => void
  onAnnounce: (a: AnnounceItem) => void
  onReady?: () => void      // scene warmed up and rendered a frame (lift the dimming cover)
  onNearEnd?: () => void     // montage is near the end (lead for the cut sound — play slightly ahead of the visual)
  onEnd: () => void
}

const WARMUP_FRAMES = 3     // frames to compile skin shaders before onReady (black is hidden by the cover)
const NEAR_END_LEAD_MS = 60    // how long before the montage end to fire onNearEnd

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
  return { id: ps.id, pos: ps.pos, aimDir: ps.aimDir, alive: ps.alive, shieldActive: ps.shieldActive, dashing: ps.dashing, windupProgress: ps.windupProgress, respawning: ps.respawning, restore: emptyBodyState() }
}

const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion()
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _pp = new THREE.Vector3()
const lerp = (a: number, b: number, s: number) => a + (b - a) * s

// Diagnostics: true → render the scene WITHOUT players/FX (only camera+grid+marker) to isolate issues.
// Left off; can be temporarily enabled when debugging.
const DEBUG_SCENE_ONLY = false

/** Arena visual WITHOUT physics (Rapier isn't needed in replay): floor + grid + map blocks + map lights. */
function DemoArena({ mapId }: { mapId: MapId }) {
  const map = MAPS[mapId]
  const [hx, hz] = map.half
  const gridGeo = useMemo(() => gridGeometry(hx, hz), [hx, hz])
  useEffect(() => () => gridGeo.dispose(), [gridGeo])
  const compiled = useMemo(() => getCachedMapGeo(map.id) ?? compileBlocksCached(map.id, map.blocks), [map])
  // Block visual (no collision — trailer). 4 groups; transparent ones are drawn with a translucent material.
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
  // Previous player flags (for transition sounds: windup/dash/shield).
  const prevFlags = useRef<Map<number, { w: number; d: boolean; s: boolean }>>(new Map())
  const scene = useThree(s => s.scene)

  const world = useMemo(() => new World(scene), [scene])
  // Create and destroy players in ONE effect — otherwise StrictMode (dev) disposes them on double
  // mount, and useMemo returns the same (already destroyed) objects → meshes aren't drawn.
  const [players, setPlayers] = useState<Player[]>([])
  useEffect(() => {
    // Planet ring: the local player gets the "secondary" color (reserveColor from the demo, else from the profile),
    // the opponent gets their own color (as in game).
    const reserve = demo.reserveColor ?? loadProfile().reserveColor
    const ps = demo.roster.map(e => buildPlayer(e, e.id === demo.localId ? (reserve ?? e.color) : e.color))
    setPlayers(ps)
    return () => ps.forEach(p => p.dispose())
  }, [demo])
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players])

  const rangeIdx = useRef(0)
  const clockMs = useRef(demo.frames[ranges[0].from]?.tMs ?? 0)
  const firedTo = useRef(ranges[0].from - 1)   // index of the last frame in the current range whose events have been played
  const lastHudIdx = useRef(-1)
  const ended = useRef(false)
  const warm = useRef(0)
  const readyFired = useRef(false)
  const nearEndFired = useRef(false)

  // On start — instantly place players at the first frame of the first range.
  useEffect(() => {
    const f = demo.frames[ranges[0].from]
    if (f) for (const ps of f.players) byId.get(ps.id)?.applyNetState(toSnap(ps))
    rangeIdx.current = 0
    clockMs.current = demo.frames[ranges[0].from]?.tMs ?? 0
    firedTo.current = ranges[0].from - 1
    lastHudIdx.current = -1; ended.current = false; warm.current = 0; readyFired.current = false
    nearEndFired.current = false
    seedFlags(prevFlags.current, f)   // don't "re-fire" a windup already in progress at the fragment start
  }, [demo, ranges, byId])

  useFrame((_, dtRaw) => {
    if (ended.current) return
    // Warmup: after WARMUP_FRAMES rendered frames — onReady (lift the dimming cover).
    if (!readyFired.current && players.length) {
      warm.current++
      if (warm.current >= WARMUP_FRAMES) { readyFired.current = true; onReady?.() }
    }
    const dt = Math.min(dtRaw, 0.05)
    clockMs.current += dt * 1000
    const tMs = clockMs.current

    // current frame within the active range [r.from..r.to]
    const r = ranges[rangeIdx.current]
    let i = r.from
    while (i < r.to && demo.frames[i + 1].tMs <= tMs) i++
    const cur = demo.frames[i]
    const nxt = demo.frames[Math.min(i + 1, r.to)]
    const span = Math.max(1, nxt.tMs - cur.tMs)
    const s = Math.max(0, Math.min(1, (tMs - cur.tMs) / span))

    // Player poses: flags/aim — from cur (applyNetState), position is driven DIRECTLY (without Rapier),
    // interpolating cur→nxt for smoothness; we position bodyGroup ourselves (in game RigidBody does this).
    if (!DEBUG_SCENE_ONLY) {
      for (const ps of cur.players) {
        const p = byId.get(ps.id); if (!p) continue
        p.applyNetState(toSnap(ps))
        p.setBodyVisible(ps.bodyVisible)
        const n = nxt.players.find(q => q.id === ps.id) ?? ps
        _pp.set(lerp(ps.pos[0], n.pos[0], s), lerp(ps.pos[1], n.pos[1], s), lerp(ps.pos[2], n.pos[2], s))
        p.setReplayPose(_pp)
        // Sounds on flag transitions: beam — from the BEGINNING of windup (variant by style), dash, shield on/off.
        const pf = prevFlags.current.get(ps.id) ?? { w: 0, d: false, s: false }
        if (pf.w <= 0.02 && ps.windupProgress > 0.02) onSfx(BEAM_SFX[styleById.get(ps.id) ?? 'classic'])
        if (!pf.d && ps.dashing) onSfx('dash')
        if (!pf.s && ps.shieldActive) onSfx('shield_up')
        if (pf.s && !ps.shieldActive) onSfx('shield_down')
        prevFlags.current.set(ps.id, { w: ps.windupProgress, d: ps.dashing, s: ps.shieldActive })
      }
      for (const p of players) p.updateRemote(dt, world)
    }

    // camera — interpolation between cur and nxt
    _p0.fromArray(cur.cam.p); _p1.fromArray(nxt.cam.p)
    camera.position.lerpVectors(_p0, _p1, s)
    _q0.set(cur.cam.q[0], cur.cam.q[1], cur.cam.q[2], cur.cam.q[3])
    _q1.set(nxt.cam.q[0], nxt.cam.q[1], nxt.cam.q[2], nxt.cam.q[3])
    camera.quaternion.copy(_q0.slerp(_q1, s))
    const cam = camera as THREE.PerspectiveCamera
    const fov = cur.cam.fov + (nxt.cam.fov - cur.cam.fov) * s
    if (cam.isPerspectiveCamera && Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix() }

    // HUD — on frame change (≤30/sec)
    if (lastHudIdx.current !== i) { lastHudIdx.current = i; onHud(hudOf(cur, demo)) }

    // transient FX of the current range's frames
    while (firedTo.current < i) {
      firedTo.current++
      applyFrameEvents(demo.frames[firedTo.current], byId, onSfx, onAnnounce, demo.roster)
    }

    // lead signal for the montage nearing its end: fire the cut sound slightly ahead of the visual (hit sync)
    if (!nearEndFired.current && rangeIdx.current === ranges.length - 1
        && tMs >= demo.frames[r.to].tMs - NEAR_END_LEAD_MS) {
      nearEndFired.current = true; onNearEnd?.()
    }

    // end of range → next fragment (jump cut) or finish the shot
    if (tMs >= demo.frames[r.to].tMs) {
      if (rangeIdx.current < ranges.length - 1) {
        rangeIdx.current++
        const nr = ranges[rangeIdx.current]
        clockMs.current = demo.frames[nr.from].tMs
        firedTo.current = nr.from - 1
        lastHudIdx.current = -1
        seedFlags(prevFlags.current, demo.frames[nr.from])   // don't trigger sounds at the fragment seam
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
      {/* In-game post-processing: neon outline of cover edges (as in a match). */}
      <MapEdges />
    </>
  )
}

type FlagState = { w: number; d: boolean; s: boolean }

/**
 * Seed prevFlags with frame `f`'s values: when splicing fragments, a windup/dash/shield already in progress is
 * treated as "known", so a transition sound (0→windup, etc.) on the fragment's first frame does NOT fire falsely.
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
        break   // beam sound — from the windup transition (see above), not here
      case 'kill': {
        byId.get(e.victim)?.applyDeath()
        onSfx('death')
        const kind = announceKind(e.streak ?? 0, e.firstBlood ?? false)   // legacy demo fields (live events are slim)
        if (kind) {
          onSfx(announceSfx(kind))
          const r = roster.find(x => x.id === e.shooter)
          onAnnounce({ name: r?.name ?? '', color: r?.color ?? '#4af', kind })   // streak banner
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
      // move/scores/time — state is taken from the frame's absolute fields (frame-independent)
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
    scores: f.players.map(p => ({ id: p.id, name: nameOf(p.id), kills: p.kills, deaths: p.deaths, team: p.id })),   // demos are 1v1 → team === id
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
