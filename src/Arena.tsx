import { useMemo, useEffect } from 'react'
import { CuboidCollider, RigidBody, MeshCollider } from '@react-three/rapier'
import { MAPS, MAP_GEO } from './game/maps'
import type { GameMap } from './game/maps'
import { DEFAULT_MAP_ID } from './constants'
import { gridGeometry } from './game/grid'
import { compileBlocksCached, buildGeometry } from './game/mapGeometryCache'
import { MapLights } from './components/MapVisualBits'
import { MapEdges, BLOCK_LAYER } from './components/EdgeOutline'
import { loadProfile } from './settings'

const BOUND_H = 32      // полу-высота невидимых периметровых стен (не выпрыгнуть за арену; с большим запасом)
const BOUND_T = 0.5     // полу-толщина невидимых стен

/** Арена по данным карты: общий пол/свет/сетка (по размеру карты) + блоки карты (батч: 2 меша + trimesh). */
export function Arena({ map = MAPS[DEFAULT_MAP_ID] }: { map?: GameMap }) {
  const [hx, hz] = map.half
  const gridGeo = useMemo(() => gridGeometry(hx, hz), [hx, hz])
  useEffect(() => () => gridGeo.dispose(), [gridGeo])

  // Геометрия из компила (geo.json), фолбэк — слияние из blocks на лету (кеш по id). Две группы (укрытия/периметр).
  const compiled = useMemo(() => MAP_GEO[map.id] ?? compileBlocksCached(map.id, map.blocks), [map.id, map.blocks])
  // Укрытия — цель боёвки-луча: строим BVH (computeBoundsTree), чтобы raycast на выстреле был O(log n), без спайка.
  const raycast = useMemo(() => {
    const g = compiled.raycast ? buildGeometry(compiled.raycast) : null
    g?.computeBoundsTree()
    return g
  }, [compiled])
  const noRaycast = useMemo(() => (compiled.noRaycast ? buildGeometry(compiled.noRaycast) : null), [compiled])
  useEffect(() => () => { raycast?.disposeBoundsTree(); raycast?.dispose(); noRaycast?.dispose() }, [raycast, noRaycast])

  const postFx = useMemo(() => loadProfile().postProcessing, [])

  return (
    <>
      <MapLights half={map.half} />

      {/* Пол: плоскость (визуал) + статический коллайдер (верх на y=0). Луч игнорит (noRaycast). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ noRaycast: true }}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={map.floorColor} />
      </mesh>
      <CuboidCollider args={[hx, 0.5, hz]} position={[0, -0.5, 0]} />

      {/* Невидимые высокие стены по периметру — не выпрыгнуть за арену (коллайдеры без меша). */}
      <CuboidCollider args={[hx, BOUND_H, BOUND_T]} position={[0, BOUND_H, -hz]} />
      <CuboidCollider args={[hx, BOUND_H, BOUND_T]} position={[0, BOUND_H, hz]} />
      <CuboidCollider args={[BOUND_T, BOUND_H, hz]} position={[-hx, BOUND_H, 0]} />
      <CuboidCollider args={[BOUND_T, BOUND_H, hz]} position={[hx, BOUND_H, 0]} />

      {/* Сетка пола 1×1 (чуть выше пола — без z-fighting). */}
      <lineSegments geometry={gridGeo} position={[0, 0.01, 0]}>
        <lineBasicMaterial color="#555" />
      </lineSegments>

      {/* Блоки карты: два слитых меша (укрытия + периметр), trimesh-коллайдеры из той же геометрии. */}
      <RigidBody type="fixed" colliders={false}>
        <MeshCollider type="trimesh">
          {raycast && (
            // Укрытия — на слое блоков (BLOCK_LAYER) → попадают в контур рёбер. block — для ПРОСТРЕЛА/прозрачности.
            <mesh geometry={raycast} castShadow receiveShadow userData={{ block: true }} onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
              <meshStandardMaterial vertexColors />
            </mesh>
          )}
          {noRaycast && (
            <mesh geometry={noRaycast} castShadow receiveShadow userData={{ noRaycast: true, block: true }}>
              <meshStandardMaterial vertexColors />
            </mesh>
          )}
        </MeshCollider>
      </RigidBody>

      {/* Экранный контур видимых рёбер укрытий (постпроцессинг — переключается в настройках) */}
      {postFx && <MapEdges />}
    </>
  )
}
