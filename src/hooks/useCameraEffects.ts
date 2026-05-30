import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface CameraState {
  isSpectator: boolean
  isWindingUp: boolean
  isMoving: boolean
}

export function useCameraEffects(
  camera: THREE.Camera,
  getState: () => CameraState
) {
  const shakeFrames = useRef(0)

  useFrame((_, delta) => {
    if (shakeFrames.current > 0) {
      camera.position.x += (Math.random() - 0.5) * 0.04
      camera.position.y += (Math.random() - 0.5) * 0.04
      shakeFrames.current--
    }

    const { isSpectator, isWindingUp, isMoving } = getState()
    const targetFov = isSpectator ? 75 : (isWindingUp ? 70 : (isMoving ? 87 : 75))
    const pcam = camera as THREE.PerspectiveCamera
    pcam.fov = THREE.MathUtils.lerp(pcam.fov, targetFov, delta * 6)
    pcam.updateProjectionMatrix()
  })

  const shake = () => { shakeFrames.current = 5 }

  return { shake }
}
