import { useRef, useEffect, useMemo, Suspense } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { Physics, RigidBody, CapsuleCollider } from '@react-three/rapier'
import { Arena } from './Arena'
import { Match } from './game/Match'
import { RapierBridge } from './components/RapierBridge'
import { useGameInput } from './hooks/useGameInput'
import type { HUDAction } from './hooks/useGameHUD'
import { CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT, CAPSULE_OFFSET_Y } from './constants'
import type { BotDifficulty } from './constants'

interface GameProps {
  dispatch: (action: HUDAction) => void
  botDifficulties?: BotDifficulty[]
}

export function Game({ dispatch, botDifficulties = ['normal'] }: GameProps) {
  const { camera, scene } = useThree()
  const keys = useGameInput()
  const controlsRef = useRef<any>(null)

  const match = useMemo(
    () => new Match({
      scene,
      camera: camera as THREE.PerspectiveCamera,
      controls: controlsRef,
      keys,
      dispatch,
      botDifficulties,
    }),
    [],
  )

  useEffect(() => {
    camera.rotation.set(0, 0, 0)
    match.installDebug(camera)
    return () => match.dispose()
  }, [camera, match])

  useEffect(() => {
    const hc = match.humanController
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) hc.onFire()
      if (e.button === 2) hc.onShield()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); hc.onJump() }
      if (e.key === 'v' || e.key === 'V') hc.toggleView()
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
  useFrame((_, dt) => match.update(Math.min(dt, 0.1)))

  return (
    <Suspense>
      <Physics timeStep="vary" interpolate={false} gravity={[0, -9.81, 0]}>
        <PointerLockControls ref={controlsRef} />
        <Arena />
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
