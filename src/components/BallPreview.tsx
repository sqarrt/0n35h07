import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { BALL_RADIUS, BALL_SEGMENTS, PREVIEW_SPIN_SPEED } from '../constants'

/** Свет медленно облетает шар — блик скользит по поверхности, превью читается как «живое» 3D. */
function OrbitingLight() {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += PREVIEW_SPIN_SPEED * dt })
  return (
    <group ref={ref}>
      <directionalLight position={[10, 10, 5]} intensity={1} />
    </group>
  )
}

interface BallPreviewProps { color: string; size?: number }

/**
 * Живое 3D-превью шара игрока: та же геометрия (`BALL_RADIUS`/`BALL_SEGMENTS`) и `MeshStandardMaterial`,
 * что и тело в бою (`src/game/Body.ts`), тот же свет, что на арене (`src/Arena.tsx`). Цвет — живой проп.
 */
export function BallPreview({ color, size = 220 }: BallPreviewProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, overflow: 'hidden',
      background: '#0a0a0f', border: '1px solid #1a2030',
    }}>
      <Canvas camera={{ position: [0, 0, 1.7], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.4} />
        <OrbitingLight />
        <mesh>
          <sphereGeometry args={[BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </Canvas>
    </div>
  )
}
