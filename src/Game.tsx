import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { Arena } from './Arena'
import { Match } from './game/Match'
import { useGameInput } from './hooks/useGameInput'
import type { HUDAction } from './hooks/useGameHUD'
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

  useFrame((_, dt) => match.update(dt))

  return (
    <>
      <PointerLockControls ref={controlsRef} />
      <Arena />
      <primitive object={match.root} />
    </>
  )
}
