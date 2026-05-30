import { RefObject, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface ArenaProps {
  targetRef: RefObject<THREE.Mesh | null>
  isStatic?: boolean
}

const SPAWN_HALF = 14  // стены на ±20, оставляем запас
const TARGET_SPEED = 2.5

export function randomArenaPos(): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * SPAWN_HALF * 2,
    1,
    (Math.random() - 0.5) * SPAWN_HALF * 2,
  )
}

function getInitialTargetPos(): THREE.Vector3 {
  const param = new URLSearchParams(window.location.search).get('targetPos')
  if (param) {
    const [x, y, z] = param.split(',').map(Number)
    return new THREE.Vector3(x, y, z)
  }
  return randomArenaPos()
}

export function Arena({ targetRef, isStatic = false }: ArenaProps) {
  const initPos = useRef(getInitialTargetPos())
  const waypointRef = useRef<THREE.Vector3>(randomArenaPos())

  // Движение мишени к waypoint
  useFrame((_, delta) => {
    if (isStatic || !targetRef.current) return
    const mesh = targetRef.current
    const wp = waypointRef.current
    const dx = wp.x - mesh.position.x
    const dz = wp.z - mesh.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < 0.5) {
      waypointRef.current = randomArenaPos()
    } else {
      mesh.position.x += (dx / dist) * TARGET_SPEED * delta
      mesh.position.z += (dz / dist) * TARGET_SPEED * delta
    }
  })

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

      {/* Target — всегда в сцене, телепортируется при попадании */}
      <mesh
        ref={targetRef}
        position={initPos.current.toArray() as [number, number, number]}
        castShadow
        name="target"
      >
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>

      <gridHelper args={[40, 20, '#666', '#333']} />
    </>
  )
}
