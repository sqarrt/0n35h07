import React, { useRef, useEffect } from 'react'
import type { BotDifficulty } from './constants'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { Arena, randomArenaPos } from './Arena'
import { Bot } from './Bot'
import { PlayerEntity } from './components/PlayerEntity'
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

  const controlsRef = useRef<any>(null)

  const botTargetRefs  = useRef<Array<{ current: THREE.Mesh | null }>>(
    Array.from({ length: botCount }, () => ({ current: null }))
  )
  const botRespawnRefs = useRef<Array<{ current: (() => void) | null }>>(
    Array.from({ length: botCount }, () => ({ current: null }))
  )
  const botShieldActives = useRef<boolean[]>(Array.from({ length: botCount }, () => false))

  useEffect(() => { camera.rotation.set(0, 0, 0) }, [camera])

  const isWindingUpRef = useRef<() => boolean>(() => false)
  const movement = usePlayerMovement(camera, keys, () => isWindingUpRef.current())

  const shield = useShieldSystem({
    onActivate:   () => dispatch({ type: 'SET_SHIELD_VISIBLE', value: true }),
    onDeactivate: () => dispatch({ type: 'SET_SHIELD_VISIBLE', value: false }),
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

  useEffect(() => {
    const w = window as any
    w.__debugCamera = camera
    w.__debugWindup = () => beam.isWindingUp()
    w.__debugTargetHitCount = 0
    return () => { delete w.__debugCamera; delete w.__debugWindup; delete w.__debugTargetHitCount }
  }, [camera])

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

      <PlayerEntity
        bodyPosRef={movement.playerBodyPos}
        getWindupProgress={beam.getWindupProgress}
        shieldIsActive={shield.isActive}
        visible={movement.isThirdPerson}
        color="#4af"
        beam={{
          activeRef:   beam.beamActiveRef,
          endRef:      beam.beamEndRef,
          fireTimeRef: beam.beamFireTimeRef,
          getStart:    beam.getBeamStart,
          afterglow:   beam.afterglow,
          particlesRef: beam.particlesRef,
          innerColor:  'white',
          outerColor:  '#0ff',
        }}
      />

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
    </>
  )
}
