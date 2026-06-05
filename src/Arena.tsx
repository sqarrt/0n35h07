import { useMemo, useEffect } from 'react'
import { CuboidCollider, RigidBody, MeshCollider } from '@react-three/rapier'
import { MAPS } from './game/maps'
import type { GameMap } from './game/maps'
import { DEFAULT_MAP_ID } from './constants'
import { unitWedgeGeometry } from './game/wedge'
import { gridGeometry } from './game/grid'
import { mergedBlockGeometries } from './game/blockGeometry'
import { MapLights } from './components/MapVisualBits'
import { MapEdges, BLOCK_LAYER } from './components/EdgeOutline'
import { loadProfile } from './settings'

const BOUND_H = 32      // полу-высота невидимых периметровых стен (не выпрыгнуть за арену; с большим запасом)
const BOUND_T = 0.5     // полу-толщина невидимых стен

/** Арена по данным карты: общий пол/свет/сетка (по размеру карты) + блоки карты (батч: 2 меша + trimesh). */
export function Arena({ map = MAPS[DEFAULT_MAP_ID] }: { map?: GameMap }) {
  const [hx, hz] = map.half
  const wedgeGeo = useMemo(() => unitWedgeGeometry(), [])
  const wedgeGeoFlip = useMemo(() => unitWedgeGeometry(true), [])
  const gridGeo = useMemo(() => gridGeometry(hx, hz), [hx, hz])
  useEffect(() => () => gridGeo.dispose(), [gridGeo])

  // Блоки слиты в две геометрии (укрытия/периметр) — рендер и trimesh-коллайдер из одной геометрии.
  const { raycast, noRaycast } = useMemo(
    () => mergedBlockGeometries(map.blocks, wedgeGeo, wedgeGeoFlip),
    [map.blocks, wedgeGeo, wedgeGeoFlip],
  )
  useEffect(() => () => { raycast?.dispose(); noRaycast?.dispose() }, [raycast, noRaycast])

  const postFx = useMemo(() => loadProfile().postProcessing, [])

  return (
    <>
      <MapLights />

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
            // Укрытия — на слое блоков (BLOCK_LAYER) → попадают в контур рёбер.
            <mesh geometry={raycast} castShadow receiveShadow onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
              <meshStandardMaterial vertexColors />
            </mesh>
          )}
          {noRaycast && (
            <mesh geometry={noRaycast} castShadow receiveShadow userData={{ noRaycast: true }}>
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
