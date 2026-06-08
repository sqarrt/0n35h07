import { useRef, useEffect, useMemo, Suspense } from 'react'
import type { ComponentRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { Physics, RigidBody, CapsuleCollider } from '@react-three/rapier'
import { Arena } from './Arena'
import { Match } from './game/Match'
import { WebAudioMusicEngine } from './game/audio/WebAudioMusicEngine'
import { RapierBridge } from './components/RapierBridge'
import { useGameInput } from './hooks/useGameInput'
import { NetSession } from './net/NetSession'
import type { INet, PeerId } from './net/INet'
import type { RosterEntry } from './net/protocol'
import type { ISfxEngine } from './game/audio/sfx/types'
import type { HUDAction } from './hooks/useGameHUD'
import { CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT, CAPSULE_OFFSET_Y } from './constants'
import type { MatchRole, MapId } from './constants'
import { MAPS } from './game/maps'

export interface GameApi { requestReady(): void }

interface GameProps {
  dispatch: (action: HUDAction) => void
  role: MatchRole
  net: INet
  netConfig: { localId: number; roster: RosterEntry[] }
  peerToPlayer: Map<PeerId, number>
  defaultThirdPerson?: boolean
  apiRef?: React.MutableRefObject<GameApi | null>
  durationMs: number
  mapId: MapId
  seedCode: string
  sfxEngine: ISfxEngine
}

export function Game({ dispatch, role, net, netConfig, peerToPlayer, defaultThirdPerson, apiRef, durationMs, mapId, seedCode, sfxEngine }: GameProps) {
  const { camera, scene } = useThree()
  const keys = useGameInput()
  const controlsRef = useRef<ComponentRef<typeof PointerLockControls>>(null)

  const match = useMemo(
    () => new Match({
      scene,
      camera: camera as THREE.PerspectiveCamera,
      controls: controlsRef,
      keys,
      dispatch,
      role,
      netConfig,
      defaultThirdPerson,
      durationMs,
      mapId,
      seedCode,
      musicEngine: new WebAudioMusicEngine(),
      sfxEngine,
    }),
    // Match строится один раз на сессию матча (пересоздание сломало бы мир/контроллеры); deps намеренно пусты.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps -- NetSession строится один раз поверх match
  const session = useMemo(() => new NetSession(net, match, peerToPlayer), [])

  useEffect(() => {
    camera.rotation.set(0, 0, 0)
    match.installDebug(camera)
    const requestReady = () => (role === 'host' ? match.markReady(match.localId) : session.sendReady())
    if (apiRef) apiRef.current = { requestReady }
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
    // Установка debug-хуков/готовности завязана на match (стабилен) и camera; прочее намеренно вне deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, match])

  // На входе в матч: listener SFX на камеру, позиционные ноды — в match.root; на выходе отцепляем.
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
      // Прыжок (Space) — held-ввод в useGameInput (auto-bhop при удержании), не рёберный onJump.
      if (e.code === 'KeyV') hc.toggleView()   // по физической клавише — не зависит от раскладки
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

  // Клампим dt: скачок кадра (загрузка WASM, возврат во вкладку) не должен
  // «промотать» заряд/кулдаун/физику за один шаг.
  useFrame((_, dt) => {
    match.update(Math.min(dt, 0.1))
    session.afterUpdate()
  })

  return (
    <Suspense>
      <Physics timeStep="vary" interpolate={false} gravity={[0, -9.81, 0]}>
        <PointerLockControls ref={controlsRef} />
        <Arena map={MAPS[mapId]} />
        <RapierBridge match={match} />

        {/* RigidBody = только физика (капсула); визуал игроков — в match.root (world-space). */}
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
  )
}
