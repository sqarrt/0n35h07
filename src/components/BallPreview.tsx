import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { BALL_RADIUS, BALL_SEGMENTS, PREVIEW_SPIN_SPEED } from '../constants'
import type { BallModel } from '../constants'
import { createBallMaterial, createBallRing } from '../game/fx/ballMaterial'

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

/** Шар выбранной модели: тот же материал (`createBallMaterial`) и кольцо (`createBallRing`), что и тело в бою. */
function Ball({ color, model }: { color: string; model: BallModel }) {
  const { material, tick } = useMemo(() => createBallMaterial(color, model), [color, model])
  const ring = useMemo(() => (model === 'planet' ? createBallRing(color) : null), [color, model])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => ring?.dispose(), [ring])
  useFrame((_, dt) => { tick(dt); ring?.tick(dt) })
  return (
    <mesh>
      <sphereGeometry args={[BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS]} />
      <primitive object={material} attach="material" />
      {ring && <primitive object={ring.mesh} />}
    </mesh>
  )
}

interface BallPreviewProps { color: string; model: BallModel; size?: number }

/** Живое 3D-превью шара игрока: та же геометрия/материал/свет, что в бою. */
export function BallPreview({ color, model, size = 220 }: BallPreviewProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, overflow: 'hidden',
      background: '#0a0a0f', border: '1px solid #1a2030',
    }}>
      <Canvas
        camera={{ position: [0, 1.4, 2.4], fov: 45 }}   // ракурс как от 3-го лица — слегка сверху
        dpr={[1, 2]}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <ambientLight intensity={0.4} />
        <OrbitingLight />
        <Ball color={color} model={model} />
      </Canvas>
    </div>
  )
}
