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
  botDifficulties?: BotDifficulty[]
}

export function Game({ dispatch, botDifficulties = ['normal'] }: GameProps) {
  const botCount = botDifficulties.length
  const { camera, scene } = useThree()
  const keys = useGameInput()

  const controlsRef    = useRef<any>(null)
  const shieldMeshRef  = useRef<THREE.Mesh>(null)
  const playerGroupRef = useRef<THREE.Group>(null!)

  // Per-bot refs — stable array objects, mutated by each Bot via useEffect
  const botTargetRefs    = useRef<Array<{ current: THREE.Mesh | null }>>(
    Array.from({ length: botCount }, () => ({ current: null }))
  )
  const botRespawnRefs   = useRef<Array<{ current: (() => void) | null }>>(
    Array.from({ length: botCount }, () => ({ current: null }))
  )
  const botShieldActives = useRef<boolean[]>(Array.from({ length: botCount }, () => false))

  useEffect(() => { camera.rotation.set(0, 0, 0) }, [camera])

  // Systems — movement first so playerBodyPos is available for beam
  const isWindingUpRef = useRef<() => boolean>(() => false)
  const movement = usePlayerMovement(camera, keys, () => isWindingUpRef.current())

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
    playerBodyPos: movement.playerBodyPos,
  })
  isWindingUpRef.current = beam.isWindingUp

  const cameraEffects = useCameraEffects(camera, () => ({
    isThirdPerson: movement.thirdPersonMode.current,
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
      if (e.key === 'v' || e.key === 'V') movement.toggleThirdPerson()
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

  // HUD progress (throttled) + player sphere position
  const lastHudUpdate = useRef(0)
  useFrame(() => {
    if (playerGroupRef.current) {
      playerGroupRef.current.position.copy(movement.playerBodyPos.current)
    }
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

      {/* Player sphere + shield bubble */}
      <group ref={playerGroupRef}>
        <mesh visible={movement.isThirdPerson} userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshStandardMaterial color="#4af" />
        </mesh>
        <mesh ref={shieldMeshRef} visible={false} userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.9, 16, 16]} />
          <meshStandardMaterial color="royalblue" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {Array.from({ length: botCount }, (_, i) => (
        <Bot
          key={i}
          botId={i}
          targetRef={botTargetRefs.current[i] as React.RefObject<THREE.Mesh | null>}
          botRespawnRef={botRespawnRefs.current[i] as React.RefObject<(() => void) | null>}
          difficulty={botDifficulties[i]}
          playerPosRef={movement.playerBodyPos}
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
            <mesh userData={{ noRaycast: true }}>
              <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
              <meshBasicMaterial color="#0ff" transparent opacity={opacity * 0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        )
      })()}

      {/* Particles */}
      {beam.particlesRef.current.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.life * 0.15} userData={{ noRaycast: true }}>
          <sphereGeometry args={[1, 4, 4]} />
          <meshBasicMaterial color="#ff0" />
        </mesh>
      ))}
    </>
  )
}
