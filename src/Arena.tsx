import { SPAWN_HALF } from './constants'
import * as THREE from 'three'
import { CuboidCollider } from '@react-three/rapier'

export function randomArenaPos(): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * SPAWN_HALF * 2,
    1,
    (Math.random() - 0.5) * SPAWN_HALF * 2,
  )
}

export function Arena() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} castShadow intensity={1} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ noRaycast: true }}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 1.5, -20]} receiveShadow castShadow userData={{ noRaycast: true }}>
        <boxGeometry args={[40, 3, 0.5]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[0, 1.5, 20]} receiveShadow castShadow userData={{ noRaycast: true }}>
        <boxGeometry args={[40, 3, 0.5]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[-20, 1.5, 0]} receiveShadow castShadow userData={{ noRaycast: true }}>
        <boxGeometry args={[0.5, 3, 40]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[20, 1.5, 0]} receiveShadow castShadow userData={{ noRaycast: true }}>
        <boxGeometry args={[0.5, 3, 40]} />
        <meshStandardMaterial color="#555" />
      </mesh>

      <gridHelper args={[40, 20, '#666', '#333']} />

      {/* Статические коллайдеры Rapier (args — полу-размеры). Пол: верх на y=0. */}
      <CuboidCollider args={[20, 0.5, 20]} position={[0, -0.5, 0]} />
      <CuboidCollider args={[20, 1.5, 0.25]} position={[0, 1.5, -20]} />
      <CuboidCollider args={[20, 1.5, 0.25]} position={[0, 1.5, 20]} />
      <CuboidCollider args={[0.25, 1.5, 20]} position={[-20, 1.5, 0]} />
      <CuboidCollider args={[0.25, 1.5, 20]} position={[20, 1.5, 0]} />
    </>
  )
}
