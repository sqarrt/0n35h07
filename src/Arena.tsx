import { useMemo, useEffect } from 'react'
import { CuboidCollider, RigidBody, MeshCollider } from '@react-three/rapier'
import { MAPS, getCachedMapGeo } from './game/maps'
import type { GameMap } from './game/maps'
import { DEFAULT_MAP_ID } from './constants'
import { gridGeometry } from './game/grid'
import { compileBlocksCached, buildGeometry } from './game/mapGeometryCache'
import { MapLights } from './components/MapVisualBits'
import { MapEdges, BLOCK_LAYER } from './components/EdgeOutline'
import { loadProfile } from './settings'

const BOUND_H = 32      // полу-высота невидимых периметровых стен (не выпрыгнуть за арену; с большим запасом)
const BOUND_T = 0.5     // полу-толщина невидимых стен
const BLOCK_TRANSPARENT_OPACITY = 0.4   // полупрозрачные блоки карты

/** Арена по данным карты: общий пол/свет/сетка (по размеру карты) + блоки карты (батч: 2 меша + trimesh). */
export function Arena({ map = MAPS[DEFAULT_MAP_ID] }: { map?: GameMap }) {
  const [hx, hz] = map.half
  const gridGeo = useMemo(() => gridGeometry(hx, hz), [hx, hz])
  useEffect(() => () => gridGeo.dispose(), [gridGeo])

  // Геометрия из компила (geo.json, preload через ensureMapGeo до монтирования), фолбэк — слияние из blocks.
  const compiled = useMemo(() => getCachedMapGeo(map.id) ?? compileBlocksCached(map.id, map.blocks), [map.id, map.blocks])
  // Визуал-группы + collider. raycast-группы (цели луча) получают BVH (computeBoundsTree) — raycast выстрела O(log n).
  const geos = useMemo(() => {
    const mk = (a: typeof compiled.opaqueRaycast, bvh: boolean) => {
      const g = a ? buildGeometry(a) : null
      if (g && bvh) g.computeBoundsTree()
      return g
    }
    return {
      opaqueRaycast: mk(compiled.opaqueRaycast, true),
      opaqueNoRaycast: mk(compiled.opaqueNoRaycast, false),
      transparentRaycast: mk(compiled.transparentRaycast, true),
      transparentNoRaycast: mk(compiled.transparentNoRaycast, false),
      collider: mk(compiled.collider, false),
    }
  }, [compiled])
  useEffect(() => () => {
    geos.opaqueRaycast?.disposeBoundsTree(); geos.transparentRaycast?.disposeBoundsTree()
    Object.values(geos).forEach(g => g?.dispose())
  }, [geos])

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

      {/* Коллайдер карты: trimesh из непроходимых блоков (невидимый меш — только для физики). */}
      <RigidBody type="fixed" colliders={false}>
        <MeshCollider type="trimesh">
          {geos.collider && <mesh geometry={geos.collider} visible={false} />}
        </MeshCollider>
      </RigidBody>

      {/* Визуал блоков: до 4 слитых мешей. raycast-группы — цели луча (нет noRaycast). baseOpacity — для World.setBlocksTransparent. */}
      {geos.opaqueRaycast && (
        <mesh geometry={geos.opaqueRaycast} castShadow receiveShadow userData={{ block: true, baseOpacity: 1 }} onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
          <meshStandardMaterial vertexColors />
        </mesh>
      )}
      {geos.transparentRaycast && (
        <mesh geometry={geos.transparentRaycast} castShadow receiveShadow userData={{ block: true, baseOpacity: BLOCK_TRANSPARENT_OPACITY }} onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
          <meshStandardMaterial vertexColors transparent opacity={BLOCK_TRANSPARENT_OPACITY} depthWrite={false} />
        </mesh>
      )}
      {geos.opaqueNoRaycast && (
        <mesh geometry={geos.opaqueNoRaycast} castShadow receiveShadow userData={{ noRaycast: true, block: true, baseOpacity: 1 }}>
          <meshStandardMaterial vertexColors />
        </mesh>
      )}
      {geos.transparentNoRaycast && (
        <mesh geometry={geos.transparentNoRaycast} castShadow receiveShadow userData={{ noRaycast: true, block: true, baseOpacity: BLOCK_TRANSPARENT_OPACITY }}>
          <meshStandardMaterial vertexColors transparent opacity={BLOCK_TRANSPARENT_OPACITY} depthWrite={false} />
        </mesh>
      )}

      {/* Экранный контур видимых рёбер укрытий (постпроцессинг — переключается в настройках) */}
      {postFx && <MapEdges />}
    </>
  )
}
