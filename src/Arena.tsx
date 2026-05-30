import { RefObject } from 'react'
import * as THREE from 'three'

interface ArenaProps {
  targetRef: RefObject<THREE.Mesh | null>
  targetAlive: boolean
}

export function Arena({ targetRef, targetAlive }: ArenaProps) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} castShadow intensity={1} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 1.5, -20]} receiveShadow castShadow>
        <boxGeometry args={[40, 3, 0.5]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[0, 1.5, 20]} receiveShadow castShadow>
        <boxGeometry args={[40, 3, 0.5]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[-20, 1.5, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 3, 40]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[20, 1.5, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 3, 40]} />
        <meshStandardMaterial color="#555" />
      </mesh>

      {/* Dummy target — исчезает при попадании */}
      {targetAlive && (
        <mesh ref={targetRef} position={[0, 1, -8]} castShadow name="target">
          <boxGeometry args={[1, 2, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      )}

      <gridHelper args={[40, 20, '#666', '#333']} />
    </>
  )
}
