import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { Group } from 'three'
import { BALL_RADIUS, BALL_SEGMENTS, PREVIEW_SPIN_SPEED } from '../constants'
import type { RosterEntry } from '../net/protocol'
import { createBallMaterial, createBallRing } from '../game/fx/ballMaterial'

// Радиус крупного фонового шара как доля высоты viewport (диаметр ≈ 0.8 высоты — «очень большой»).
const BALL_VIEWPORT_FRACTION = 0.4

/** Свет медленно облетает шары — блик скользит, модели читаются как «живое» 3D (как в превью настроек). */
function OrbitingLight() {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += PREVIEW_SPIN_SPEED * dt })
  return (
    <group ref={ref}>
      <directionalLight position={[10, 10, 5]} intensity={1} />
    </group>
  )
}

/**
 * Крупный шар игрока, привязанный к краю экрана: центр шара — ровно на левой/правой кромке viewport'а,
 * поэтому половина уходит за кадр (frustum-клип, без DOM-рамки → кольцо `planet` не «режется коробкой»).
 * Размер/позиция считаются из мировых единиц viewport'а — устойчиво к ресайзу.
 */
function EdgeBall({ entry, side }: { entry: RosterEntry; side: 'left' | 'right' }) {
  const viewport = useThree(s => s.viewport)
  const { material, tick } = useMemo(
    () => createBallMaterial(entry.color, entry.ballModel ?? 'smooth'),
    [entry.color, entry.ballModel],
  )
  const ring = useMemo(
    () => (entry.ballModel === 'planet' ? createBallRing(entry.color) : null),
    [entry.color, entry.ballModel],
  )
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => ring?.dispose(), [ring])
  useFrame((_, dt) => { tick(dt); ring?.tick(dt) })

  const scale = (viewport.height * BALL_VIEWPORT_FRACTION) / BALL_RADIUS
  const x = (side === 'left' ? -1 : 1) * viewport.width / 2   // центр шара на кромке → половина за кадром
  return (
    <group position={[x, 0, 0]} scale={scale}>
      <mesh>
        <sphereGeometry args={[BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS]} />
        <primitive object={material} attach="material" />
        {ring && <primitive object={ring.mesh} />}
      </mesh>
    </group>
  )
}

interface LobbyBackdropProps { host?: RosterEntry; opponent?: RosterEntry }

/** Прозрачный полноэкранный фон лобби: крупные «живые» модельки игроков по краям (хост слева, соперник справа). */
export function LobbyBackdrop({ host, opponent }: LobbyBackdropProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas gl={{ alpha: true }} dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <OrbitingLight />
        {host && <EdgeBall entry={host} side="left" />}
        {opponent && <EdgeBall entry={opponent} side="right" />}
      </Canvas>
    </div>
  )
}
