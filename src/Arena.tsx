import { RefObject } from 'react'
import * as THREE from 'three'
import { Bot } from './Bot'

interface ArenaProps {
  targetRef: RefObject<THREE.Mesh | null>
  botRespawnRef: RefObject<(() => void) | null>
  isStatic?: boolean
  camera: THREE.Camera
  isShieldActive: () => boolean
  onPlayerHit: () => void
}

const SPAWN_HALF = 14

export function randomArenaPos(): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * SPAWN_HALF * 2,
    1,
    (Math.random() - 0.5) * SPAWN_HALF * 2,
  )
}

export function Arena({ targetRef, botRespawnRef, isStatic = false, camera, isShieldActive, onPlayerHit }: ArenaProps) {
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

      <Bot
        targetRef={targetRef}
        botRespawnRef={botRespawnRef}
        camera={camera}
        isShieldActive={isShieldActive}
        onPlayerHit={onPlayerHit}
        isStatic={isStatic}
      />

      <gridHelper args={[40, 20, '#666', '#333']} />
    </>
  )
}
