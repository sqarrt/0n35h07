import { CuboidCollider } from '@react-three/rapier'
import { MAPS, ARENA_FLOOR_HALF } from './game/maps'
import type { GameMap } from './game/maps'
import { DEFAULT_MAP_ID } from './constants'

const FLOOR_SIZE = ARENA_FLOOR_HALF * 2

/** Арена по данным карты: общий пол/свет/сетка + боксы карты (видимый меш + Rapier-коллайдер). */
export function Arena({ map = MAPS[DEFAULT_MAP_ID] }: { map?: GameMap }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} castShadow intensity={1} />

      {/* Пол: плоскость (визуал) + статический коллайдер (верх на y=0). Луч игнорит (noRaycast). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ noRaycast: true }}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial color={map.floorColor} />
      </mesh>
      <CuboidCollider args={[ARENA_FLOOR_HALF, 0.5, ARENA_FLOOR_HALF]} position={[0, -0.5, 0]} />

      <gridHelper args={[FLOOR_SIZE, 20, '#666', '#333']} />

      {/* Боксы карты: стены/базы/укрытия/колонны. blocksBeam=false → меш noRaycast (луч проходит). */}
      {map.blocks.map((b, i) => (
        <group key={i}>
          <mesh position={b.pos} receiveShadow castShadow userData={{ noRaycast: b.blocksBeam === false }}>
            <boxGeometry args={[b.size[0] * 2, b.size[1] * 2, b.size[2] * 2]} />
            <meshStandardMaterial color={b.color} />
          </mesh>
          <CuboidCollider args={b.size} position={b.pos} />
        </group>
      ))}
    </>
  )
}
