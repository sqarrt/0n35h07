import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  MOVE_SPEED, EYE_HEIGHT, JUMP_FORCE, GRAVITY,
  TP_DIST, TP_HEIGHT, WINDUP_MOVE_FACTOR,
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
  const thirdPersonMode = useRef(false)
  const playerBodyPos   = useRef(new THREE.Vector3(0, EYE_HEIGHT, 5))
  const [isThirdPerson, setIsThirdPerson] = useState(false)

  useFrame((_, delta) => {
    const k = keys.current
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()

    const physicsDelta = getIsWindingUp() ? delta * WINDUP_MOVE_FACTOR : delta

    if (!thirdPersonMode.current) {
      if (k.forward) camera.position.addScaledVector(dir,    MOVE_SPEED * physicsDelta)
      if (k.back)    camera.position.addScaledVector(dir,   -MOVE_SPEED * physicsDelta)
      if (k.left)    camera.position.addScaledVector(right,  -MOVE_SPEED * physicsDelta)
      if (k.right)   camera.position.addScaledVector(right,   MOVE_SPEED * physicsDelta)

      if (!onGround.current) {
        velocityY.current += GRAVITY * physicsDelta
        camera.position.y += velocityY.current * physicsDelta
      }
      if (camera.position.y <= EYE_HEIGHT) {
        camera.position.y = EYE_HEIGHT
        velocityY.current = 0
        onGround.current = true
      }

      playerBodyPos.current.copy(camera.position)
    } else {
      if (k.forward) playerBodyPos.current.addScaledVector(dir,    MOVE_SPEED * physicsDelta)
      if (k.back)    playerBodyPos.current.addScaledVector(dir,   -MOVE_SPEED * physicsDelta)
      if (k.left)    playerBodyPos.current.addScaledVector(right,  -MOVE_SPEED * physicsDelta)
      if (k.right)   playerBodyPos.current.addScaledVector(right,   MOVE_SPEED * physicsDelta)

      if (!onGround.current) {
        velocityY.current += GRAVITY * physicsDelta
        playerBodyPos.current.y += velocityY.current * physicsDelta
      }
      if (playerBodyPos.current.y <= EYE_HEIGHT) {
        playerBodyPos.current.y = EYE_HEIGHT
        velocityY.current = 0
        onGround.current = true
      }

      const lookH = new THREE.Vector3()
      camera.getWorldDirection(lookH)
      lookH.y = 0
      lookH.normalize()
      camera.position.copy(playerBodyPos.current).addScaledVector(lookH, -TP_DIST)
      camera.position.y = playerBodyPos.current.y + TP_HEIGHT
    }
  })

  const jump = () => {
    if (onGround.current) {
      velocityY.current = JUMP_FORCE
      onGround.current = false
    }
  }

  const toggleThirdPerson = () => {
    const entering = !thirdPersonMode.current
    thirdPersonMode.current = entering
    setIsThirdPerson(entering)
    if (entering) {
      playerBodyPos.current.copy(camera.position)
    } else {
      camera.position.copy(playerBodyPos.current)
      velocityY.current = 0
      onGround.current = playerBodyPos.current.y <= EYE_HEIGHT + 0.01
    }
  }

  const resetPosition = (spawnPos: THREE.Vector3) => {
    camera.position.set(spawnPos.x, EYE_HEIGHT, spawnPos.z)
    playerBodyPos.current.set(spawnPos.x, EYE_HEIGHT, spawnPos.z)
    velocityY.current = 0
    onGround.current = true
  }

  return {
    velocityY,
    onGround,
    isThirdPerson,
    playerBodyPos,
    thirdPersonMode,
    jump,
    toggleThirdPerson,
    resetPosition,
  }
}
