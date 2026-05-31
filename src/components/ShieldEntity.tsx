import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface ShieldEntityProps {
  isActive: () => boolean
}

export function ShieldEntity({ isActive }: ShieldEntityProps) {
  const groupRef   = useRef<THREE.Group>(null!)
  const matRef     = useRef<THREE.MeshBasicMaterial>(null!)
  const wireRef    = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(() => {
    if (!groupRef.current || !matRef.current || !wireRef.current) return
    const on = isActive()
    groupRef.current.visible = on
    if (on) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.007)
      matRef.current.opacity  = 0.08 + 0.1 * pulse
      wireRef.current.opacity = 0.3  + 0.3 * pulse
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh userData={{ noRaycast: true }}>
        <sphereGeometry args={[0.75, 16, 16]} />
        <meshBasicMaterial
          ref={matRef}
          color="#4af"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh userData={{ noRaycast: true }}>
        <sphereGeometry args={[0.76, 12, 8]} />
        <meshBasicMaterial
          ref={wireRef}
          color="#4af"
          wireframe
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
