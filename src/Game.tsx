import { useRef, useEffect, useMemo, memo, Suspense } from 'react'
import type { ComponentRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { Physics, RigidBody, CapsuleCollider } from '@react-three/rapier'
import { Arena } from './Arena'
import { Match } from './game/Match'
import { createAchievements } from './steam/achievements'
import { WebAudioMusicEngine } from './game/audio/WebAudioMusicEngine'
import { STEM_LIBRARY } from './game/audio/stems'
import { RapierBridge } from './components/RapierBridge'
import { useGameInput } from './hooks/useGameInput'
import { NetSession } from './net/NetSession'
import type { DemoFile } from './game/demo/demoTypes'
import type { INet, PeerId } from './net/INet'
import type { RosterEntry } from './net/protocol'
import type { ISfxEngine } from './game/audio/sfx/types'
import type { AudioAnalysis } from './game/audio/AudioAnalysis'
import type { HUDAction } from './hooks/useGameHUD'
import { CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT, CAPSULE_OFFSET_Y } from './constants'
import type { MatchRole, MapId } from './constants'
import { MAPS } from './game/maps'

export interface GameApi {
  requestReady(): void
  setMusicVolume(v: number): void   // live music volume (applied imperatively — no Canvas re-render)
  startDemo(): void
  stopDemo(): DemoFile | null
  isRecordingDemo(): boolean
}

interface GameProps {
  dispatch: (action: HUDAction) => void
  role: MatchRole
  net: INet
  netConfig: { localId: number; roster: RosterEntry[] }
  peerToPlayer: Map<PeerId, number>
  reserveColor: string   // local player's "second" color (their planet's ring)
  defaultThirdPerson?: boolean
  apiRef?: React.MutableRefObject<GameApi | null>
  durationMs: number
  mapId: MapId
  seedCode: string
  sfxEngine: ISfxEngine
  // Music volume via a STABLE ref (not a value prop): live changes (the in-match volume slider) are pushed
  // imperatively through GameApi.setMusicVolume, so dragging the slider never re-renders the Canvas.
  musicVolumeRef: React.MutableRefObject<number>
  audioAnalysis: AudioAnalysis   // we register the match music level here (for visualization)
  radioActive?: boolean   // Radio mode is playing (menu→match uninterrupted) → skip the stem-based match music
}

// memo: HUD updates (SET_WINDUP_PROGRESS every charge frame, etc.) re-render App, but must NOT
// touch Canvas/post-process — otherwise EffectComposer rebuilds the shader every frame (spike during charge).
// Game's props are stable for the duration of the match (gameNet/profile), so memo blocks redundant re-renders.
function GameImpl({ dispatch, role, net, netConfig, peerToPlayer, reserveColor, defaultThirdPerson, apiRef, durationMs, mapId, seedCode, sfxEngine, musicVolumeRef, audioAnalysis, radioActive }: GameProps) {
  // Selectors, not the whole useThree(): subscribing to the entire store would re-render Game (and the whole
  // subtree, including Arena post-process) on every r3f state update.
  const camera = useThree(s => s.camera)
  const scene = useThree(s => s.scene)
  const keys = useGameInput()
  const controlsRef = useRef<ComponentRef<typeof PointerLockControls>>(null)

  // Keep the music engine as a ref (not inline) so we can pass through the user's volume.
  const musicEngine = useMemo(() => new WebAudioMusicEngine(), [])

  const match = useMemo(
    () => new Match({
      scene,
      camera: camera as THREE.PerspectiveCamera,
      controls: controlsRef,
      keys,
      dispatch,
      role,
      netConfig,
      localReserveColor: reserveColor,
      defaultThirdPerson,
      durationMs,
      mapId,
      seedCode,
      // Radio mode replaces the stem-based match music: give Match no engine → its music stays null,
      // and start()/fadeOut() become no-ops (radio keeps playing across menu→match).
      musicEngine: radioActive ? undefined : musicEngine,
      sfxEngine,
      achievements: createAchievements(),
    }),
    // Match is built once per match session (recreating it would break the world/controllers); deps are intentionally empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Initial music volume (stored by the engine, applied at track start). Live changes come through
  // GameApi.setMusicVolume (below) — not a re-render. eslint-disable: read the ref once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { musicEngine.setMasterGain(musicVolumeRef.current) }, [musicEngine])

  // Preload (decode) music stems on mount — during the ready ritual/countdown, so the start of the fight
  // (live) doesn't hit a spike decoding ~58 buffers. start() at live then only schedules (buffers are ready).
  useEffect(() => { if (!radioActive) void musicEngine.load(STEM_LIBRARY) }, [musicEngine, radioActive])

  // Register the match music level+spectrum into the shared analysis (for the visualizer); unregister on unmount.
  useEffect(() => {
    const offL = audioAnalysis.addReader(() => musicEngine.readLevel())
    const offB = audioAnalysis.addBandReader(out => musicEngine.readBands(out))
    return () => { offL(); offB() }
  }, [audioAnalysis, musicEngine])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- NetSession is built once on top of match
  const session = useMemo(() => new NetSession(net, match, peerToPlayer), [])

  useEffect(() => {
    camera.rotation.set(0, 0, 0)
    match.installDebug(camera)
    const requestReady = () => (role === 'host' ? match.markReady(match.localId) : session.sendReady())
    // Demo recording is dev-ONLY (the trailer source). The branch under import.meta.env.DEV is stripped from the
    // prod build (DCE), and DemoRecorder is loaded dynamically — it doesn't end up in the game's prod bundle.
    let demoApi: Pick<GameApi, 'startDemo' | 'stopDemo' | 'isRecordingDemo'> = {
      startDemo: () => {}, stopDemo: () => null, isRecordingDemo: () => false,
    }
    if (import.meta.env.DEV) {
      demoApi = {
        startDemo: () => {
          if (match.role !== 'host') return   // host only: it emits events and owns the authoritative state
          void import('./game/demo/DemoRecorder').then(({ DemoRecorder }) => {
            match.recorder = new DemoRecorder({ roster: netConfig.roster, mapId, durationMs, localId: match.localId, reserveColor })
          })
        },
        stopDemo: () => { const f = match.recorder ? match.recorder.build() : null; match.recorder = null; return f },
        isRecordingDemo: () => !!match.recorder,
      }
    }
    if (apiRef) apiRef.current = { requestReady, setMusicVolume: (v: number) => musicEngine.setMasterGain(v), ...demoApi }
    const w = window
    w.__debugPhase = () => match.phase
    w.__debugReady = requestReady
    w.__debugForceLive = () => match.forceLiveForTest()
    w.__debugLeave = () => net.leave()
    return () => {
      match.dispose()
      if (apiRef) apiRef.current = null
      delete w.__debugPhase
      delete w.__debugReady
      delete w.__debugForceLive
      delete w.__debugLeave
    }
    // Installing debug hooks/ready is tied to match (stable) and camera; the rest is intentionally outside deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, match])

  // On entering the match: SFX listener on the camera, positional nodes in match.root; detach on exit.
  useEffect(() => {
    sfxEngine.attach(camera, match.root)
    return () => sfxEngine.detach()
  }, [camera, match, sfxEngine])

  useEffect(() => {
    const hc = match.humanController
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) hc.onFire()
      if (e.button === 2) hc.onShield()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      // Jump (Space) is held input in useGameInput (auto-bhop while held), not an edge-triggered onJump.
      if (e.code === 'KeyV') hc.toggleView()   // by physical key — independent of keyboard layout
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') hc.onDash()
    }
    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('mousedown',   onMouseDown)
    window.addEventListener('keydown',     onKeyDown)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('mousedown',   onMouseDown)
      window.removeEventListener('keydown',     onKeyDown)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [match])

  // Clamp dt: a frame spike (WASM loading, returning to the tab) must not
  // "fast-forward" charge/cooldown/physics in a single step.
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1)
    match.update(d)
    if (import.meta.env.DEV) match.recorder?.capture(match, camera as THREE.PerspectiveCamera, d)   // dev: capture demo frame
    session.afterUpdate()
  })

  return (
    <>
      {/* OUTSIDE <Suspense>/<Physics>: PointerLockControls needs only the camera, not Rapier. While the WASM
          loads, the canvas subtree is suspended — but the READY screen (HUD in App) is already up and "Ready"
          can be clicked, which grabs pointer lock. If the controls weren't mounted yet, drei misses that
          pointerlockchange and its isLocked stays false → the mouse won't turn the view until a later canvas
          click re-locks through the now-mounted controls. Mounting it eagerly fixes the "needs a second click".
          selector="canvas": drei otherwise binds click→lock to the whole `document`, so ANY click — including
          the pause menu / in-match settings — would re-grab pointer lock and dismiss the overlay. Scoped to the
          canvas (covered by the pause overlay), only Resume (handleResume) re-locks. */}
      <PointerLockControls ref={controlsRef} selector="canvas" />
      <Suspense>
        <Physics timeStep="vary" interpolate={false} gravity={[0, -9.81, 0]}>
          <Arena map={MAPS[mapId]} />
          <RapierBridge match={match} />

          {/* RigidBody = physics only (capsule); player visuals are in match.root (world-space). */}
          {match.players.map(p => (
            <RigidBody
              key={p.id}
              type="kinematicPosition"
              colliders={false}
              position={[p.spawn.x, p.spawn.y, p.spawn.z]}
              ref={p.bindBody}
            >
              <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} position={[0, CAPSULE_OFFSET_Y, 0]} />
            </RigidBody>
          ))}

          <primitive object={match.root} />
        </Physics>
      </Suspense>
    </>
  )
}

export const Game = memo(GameImpl)
