import { Canvas } from '@react-three/fiber'
import type { GameMap } from '../game/maps'
import { ARENA_FLOOR_HALF } from '../game/maps'

const FLOOR = ARENA_FLOOR_HALF * 2
const PREVIEW_W = 150
const PREVIEW_H = 100

/** Геометрия карты (пол + боксы) без физики/игроков — для статичного 3D-превью и размытого фона. */
export function MapScene({ map }: { map: GameMap }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[12, 20, 8]} intensity={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[FLOOR, FLOOR]} />
        <meshStandardMaterial color={map.floorColor} />
      </mesh>
      {map.blocks.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={[b.size[0] * 2, b.size[1] * 2, b.size[2] * 2]} />
          <meshStandardMaterial color={b.color} />
        </mesh>
      ))}
    </>
  )
}

/**
 * Реальное 3D-превью карты под углом (а не схема): рендерит геометрию карты из тех же данных, что и арена.
 * frameloop="demand" → один статичный кадр, без цикла анимации (дёшево, как «скриншот», но всегда актуально).
 */
export function MapPreview({ map }: { map: GameMap }) {
  return (
    <Canvas
      className="map-preview"
      aria-label={`Карта ${map.id}`}
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: PREVIEW_W, height: PREVIEW_H, display: 'block' }}
      camera={{ position: [0, 34, 38], fov: 45 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <MapScene map={map} />
    </Canvas>
  )
}
