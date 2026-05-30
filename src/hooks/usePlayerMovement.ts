import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  MOVE_SPEED, EYE_HEIGHT, JUMP_FORCE, GRAVITY,
  ORBIT_RADIUS, WINDUP_MOVE_FACTOR,
} from '../constants'

interface GameKeys {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
}

export function usePlayerMovement(
  camera: THREE.Camera,
  keys: React.MutableRefObject<GameKeys>,
  getIsWindingUp: () => boolean
) {
  const velocityY       = useRef(0)
  const onGround        = useRef(true)
  const spectatorMode   = useRef(false)
  const frozenPlayerPos = useRef(new THREE.Vector3())
  const [isSpectator, setIsSpectator] = useState(false)

  useFrame((_, delta) => {
    const k = keys.current
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()

    const physicsDelta = getIsWindingUp() ? delta * WINDUP_MOVE_FACTOR : delta

    if (!spectatorMode.current) {
      if (k.forward) camera.position.addScaledVector(dir,   MOVE_SPEED * physicsDelta)
      if (k.back)    camera.position.addScaledVector(dir,  -MOVE_SPEED * physicsDelta)
      if (k.left)    camera.position.addScaledVector(right, -MOVE_SPEED * physicsDelta)
      if (k.right)   camera.position.addScaledVector(right,  MOVE_SPEED * physicsDelta)

      if (!onGround.current) {
        velocityY.current += GRAVITY * physicsDelta
        camera.position.y += velocityY.current * physicsDelta
      }
      if (camera.position.y <= EYE_HEIGHT) {
        camera.position.y = EYE_HEIGHT
        velocityY.current = 0
        onGround.current = true
      }
    } else {
      const spectDir = new THREE.Vector3()
      camera.getWorldDirection(spectDir)
      camera.position.copy(frozenPlayerPos.current).addScaledVector(spectDir, -ORBIT_RADIUS)
    }
  })

  const jump = () => {
    if (onGround.current && !spectatorMode.current) {
      velocityY.current = JUMP_FORCE
      onGround.current = false
    }
  }

  const toggleSpectator = () => {
    const entering = !spectatorMode.current
    spectatorMode.current = entering
    setIsSpectator(entering)
    if (entering) {
      frozenPlayerPos.current.copy(camera.position)
    } else {
      camera.position.copy(frozenPlayerPos.current)
      velocityY.current = 0
      onGround.current = frozenPlayerPos.current.y <= EYE_HEIGHT + 0.01
    }
  }

  const resetPosition = (spawnPos: THREE.Vector3) => {
    camera.position.set(spawnPos.x, EYE_HEIGHT, spawnPos.z)
    velocityY.current = 0
    onGround.current = true
  }

  return {
    velocityY,
    onGround,
    isSpectator,
    frozenPlayerPos,
    spectatorMode,
    jump,
    toggleSpectator,
    resetPosition,
  }
}
