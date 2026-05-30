import React, { useRef, useEffect } from 'react'
import type { BotDifficulty } from './constants'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { Arena, randomArenaPos } from './Arena'
import { Bot } from './Bot'
import { Beam3D } from './components/Beam3D'
import { useGameInput } from './hooks/useGameInput'
import { useShieldSystem } from './hooks/useShieldSystem'
import { usePlayerMovement } from './hooks/usePlayerMovement'
import { useBeamWeapon } from './hooks/useBeamWeapon'
import { useCameraEffects } from './hooks/useCameraEffects'
import type { HUDAction } from './hooks/useGameHUD'

interface GameProps {
  dispatch: (action: HUDAction) => void
  botCount?: number
  botDifficulty?: BotDifficulty
}

export function Game({ dispatch, botCount = 1, botDifficulty = 'normal' }: GameProps) {
  const { camera, scene } = useThree()
  const keys = useGameInput()

  const controlsRef   = useRef<any>(null)
  const shieldMeshRef = useRef<THREE.Mesh>(null)

  // Per-bot refs — stable array objects, mutated by each Bot via useEffect
  const botTargetRefs    = useRef<Array<{ current: THREE.Mesh | null }>>(
    Array.from({ length: botCount }, () => ({ current: null }))
  )
  const botRespawnRefs   = useRef<Array<{ current: (() => void) | null }>>(
    Array.from({ length: botCount }, () => ({ current: null }))
  )
  const botShieldActives = useRef<boolean[]>(Array.from({ length: botCount }, () => false))

  // Shield 3D mesh (camera-attached sphere)
  useEffect(() => {
    const geo = new THREE.SphereGeometry(0.9, 16, 16)
    const mat = new THREE.MeshStandardMaterial({ color: 'royalblue', transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.userData.noRaycast = true
    mesh.visible = false
    shieldMeshRef.current = mesh
    camera.add(mesh)
    return () => { camera.remove(mesh); geo.dispose(); mat.dispose() }
  }, [camera])

  useEffect(() => { camera.rotation.set(0, 0, 0) }, [camera])

  // Systems
  const shield = useShieldSystem({
    onActivate: () => {
      dispatch({ type: 'SET_SHIELD_VISIBLE', value: true })
      if (shieldMeshRef.current) shieldMeshRef.current.visible = true
    },
    onDeactivate: () => {
      dispatch({ type: 'SET_SHIELD_VISIBLE', value: false })
      if (shieldMeshRef.current) shieldMeshRef.current.visible = false
    },
  })

  const beam = useBeamWeapon(camera, scene, {
    controlsRef,
    getBotShieldActive: (id) => botShieldActives.current[id] ?? false,
    getBotRespawn: (id) => botRespawnRefs.current[id]?.current ?? null,
    onBotShieldHit: () => dispatch({ type: 'BOT_SHIELD_HIT' }),
    onFire: () => {
      dispatch({ type: 'BEAM_FLASH' })
      cameraEffects.shake()
    },
    dispatch,
  })

  const movement = usePlayerMovement(camera, keys, beam.isWindingUp)

  const cameraEffects = useCameraEffects(camera, () => ({
    isSpectator: movement.spectatorMode.current,
    isWindingUp: beam.isWindingUp(),
    isMoving: !!(keys.current.forward || keys.current.back || keys.current.left || keys.current.right),
  }))

  // Debug
  useEffect(() => {
    const w = window as any
    w.__debugCamera = camera
    w.__debugWindup = () => beam.isWindingUp()
    w.__debugTargetHitCount = 0
    return () => { delete w.__debugCamera; delete w.__debugWindup; delete w.__debugTargetHitCount }
  }, [camera])

  // Input events
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) beam.startWindup()
      if (e.button === 2) shield.activate()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        movement.jump()
      }
      if (e.key === 'v' || e.key === 'V') movement.toggleSpectator()
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
  }, [])

  // HUD progress (throttled)
  const lastHudUpdate = useRef(0)
  useFrame(() => {
    const now = Date.now()
    if (now - lastHudUpdate.current > 50) {
      lastHudUpdate.current = now
      dispatch({ type: 'SET_BEAM_PROGRESS',   value: beam.getCooldownProgress(now) })
      dispatch({ type: 'SET_SHIELD_PROGRESS', value: shield.getProgress(now) })
    }
  })

  const handlePlayerHit = () => {
    beam.resetOnDeath()
    shield.reset()
    const spawnPos = randomArenaPos()
    movement.resetPosition(spawnPos)
    if (controlsRef.current) controlsRef.current.pointerSpeed = 1.0
    dispatch({ type: 'PLAYER_HIT' })
    botRespawnRefs.current.forEach(r => r.current?.())
  }

  return (
    <>
      <PointerLockControls ref={controlsRef} />
      <Arena />
      {Array.from({ length: botCount }, (_, i) => (
        <Bot
          key={i}
          botId={i}
          targetRef={botTargetRefs.current[i] as React.RefObject<THREE.Mesh | null>}
          botRespawnRef={botRespawnRefs.current[i] as React.RefObject<(() => void) | null>}
          difficulty={botDifficulty}
          camera={camera}
          isShieldActive={shield.isActive}
          onPlayerHit={handlePlayerHit}
          onShieldBlock={() => dispatch({ type: 'SHIELD_BLOCK' })}
          onBotShieldChange={active => { botShieldActives.current[i] = active }}
        />
      ))}

      {/* Player beam */}
      <Beam3D
        getStart={beam.getBeamStart}
        endRef={beam.beamEndRef}
        activeRef={beam.beamActiveRef}
        fireTimeRef={beam.beamFireTimeRef}
        innerColor="white"
        outerColor="#0ff"
        outerOpacity={0.6}
      />

      {/* Afterglow */}
      {beam.afterglow && (() => {
        const { start, end, opacity } = beam.afterglow!
        const dir = end.clone().sub(start)
        const len = dir.length()
        const mid = start.clone().lerp(end, 0.5)
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
        return (
          <group position={mid} quaternion={quat} scale={[1, len, 1]}>
            <mesh>
              <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
              <meshBasicMaterial color="#0ff" transparent opacity={opacity * 0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        )
      })()}

      {/* Particles */}
      {beam.particlesRef.current.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.life * 0.15}>
          <sphereGeometry args={[1, 4, 4]} />
          <meshBasicMaterial color="#ff0" />
        </mesh>
      ))}

      {/* Spectator marker */}
      {movement.isSpectator && (
        <group position={movement.frozenPlayerPos.current.toArray() as [number, number, number]}>
          <mesh>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshBasicMaterial color="#4af" />
          </mesh>
        </group>
      )}
    </>
  )
}
