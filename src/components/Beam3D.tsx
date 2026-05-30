import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { BEAM_DURATION } from '../constants'

interface Beam3DProps {
  getStart: () => THREE.Vector3
  endRef: React.RefObject<THREE.Vector3 | null>
  activeRef: React.MutableRefObject<boolean>
  fireTimeRef: React.MutableRefObject<number>
  duration?: number
  innerColor?: string
  outerColor?: string
  outerOpacity?: number
  groupUserData?: Record<string, unknown>
}

export function Beam3D({
  getStart,
  endRef,
  activeRef,
  fireTimeRef,
  duration = BEAM_DURATION,
  innerColor = 'white',
  outerColor = '#0ff',
  outerOpacity = 0.6,
  groupUserData = {},
}: Beam3DProps) {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    if (!groupRef.current) return
    if (!activeRef.current || !endRef.current) {
      groupRef.current.visible = false
      return
    }
    const elapsed = Date.now() - fireTimeRef.current
    const t = Math.min(elapsed / duration, 1)
    if (t >= 1) {
      activeRef.current = false
      groupRef.current.visible = false
      return
    }
    const start = getStart()
    const end = endRef.current
    const beamDir = end.clone().sub(start)
    const len = beamDir.length()
    const mid = start.clone().lerp(end, 0.5)
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      beamDir.normalize()
    )
    groupRef.current.position.copy(mid)
    groupRef.current.quaternion.copy(quat)
    groupRef.current.scale.set(1 - t, len, 1 - t)
    groupRef.current.visible = true
  })

  return (
    <group ref={groupRef} visible={false} userData={groupUserData}>
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
        <meshBasicMaterial color={innerColor} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
        <meshBasicMaterial
          color={outerColor}
          transparent
          opacity={outerOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
