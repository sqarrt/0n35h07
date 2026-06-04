import { CuboidCollider } from '@react-three/rapier'
import { MAPS } from './game/maps'
import type { GameMap } from './game/maps'
import { DEFAULT_MAP_ID } from './constants'

/** Арена по данным карты: общий пол/свет/сетка (по размеру карты) + боксы карты (меш + Rapier-коллайдер). */
export function Arena({ map = MAPS[DEFAULT_MAP_ID] }: { map?: GameMap }) {
  const [hx, hz] = map.half
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} castShadow intensity={1} />

      {/* Пол: плоскость (визуал) + статический коллайдер (верх на y=0). Луч игнорит (noRaycast). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ noRaycast: true }}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={map.floorColor} />
      </mesh>
      <CuboidCollider args={[hx, 0.5, hz]} position={[0, -0.5, 0]} />

      {/* Сетка квадратная по природе → масштабируем по Z под прямоугольный пол. */}
      <gridHelper args={[hx * 2, 20, '#666', '#333']} scale={[1, 1, hz / hx]} />

      {/* Боксы карты: стены/базы/укрытия/колонны. blocksBeam=false → меш noRaycast (луч проходит). */}
      {map.blocks.map((b, i) => (
        <group key={i}>
          <mesh position={b.pos} rotation={b.rot} receiveShadow castShadow userData={{ noRaycast: b.blocksBeam === false }}>
            <boxGeometry args={[b.size[0] * 2, b.size[1] * 2, b.size[2] * 2]} />
            <meshStandardMaterial color={b.color} />
          </mesh>
          <CuboidCollider args={b.size} position={b.pos} rotation={b.rot} />
        </group>
      ))}
    </>
  )
}
