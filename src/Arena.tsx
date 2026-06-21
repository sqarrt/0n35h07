import { useMemo, useEffect } from 'react'
import { CuboidCollider, RigidBody, MeshCollider } from '@react-three/rapier'
import { MAPS, getCachedMapGeo } from './game/maps'
import type { GameMap } from './game/maps'
import { DEFAULT_MAP_ID, BLOCK_TRANSPARENT_OPACITY } from './constants'
import { gridGeometry } from './game/grid'
import { blockGridGeometry, BLOCK_GRID_COLOR, BLOCK_GRID_OPACITY } from './game/blockGrid'
import { compileBlocksCached, buildGeometry } from './game/mapGeometryCache'
import { MapLights } from './components/MapVisualBits'
import { MapEdges, BLOCK_LAYER } from './components/EdgeOutline'
import { loadProfile } from './settings'

const BOUND_H = 32      // half-height of invisible perimeter walls (can't jump out of the arena; generous margin)
const BOUND_T = 0.5     // half-thickness of invisible walls

/** Arena from map data: shared floor/light/grid (by map size) + map blocks (batched: 2 meshes + trimesh). */
export function Arena({ map = MAPS[DEFAULT_MAP_ID] }: { map?: GameMap }) {
  const [hx, hz] = map.half
  const gridGeo = useMemo(() => gridGeometry(hx, hz), [hx, hz])
  useEffect(() => () => gridGeo.dispose(), [gridGeo])

  // Cube grid (voxel cell edges, as in the editor) — only if the map explicitly enabled showBlockGrid.
  const blockGridGeo = useMemo(() => (map.showBlockGrid ? blockGridGeometry(map.blocks) : null), [map.showBlockGrid, map.blocks])
  useEffect(() => () => blockGridGeo?.dispose(), [blockGridGeo])

  // Geometry from compile (geo.json, preloaded via ensureMapGeo before mounting), fallback — merge from blocks.
  const compiled = useMemo(() => getCachedMapGeo(map.id) ?? compileBlocksCached(map.id, map.blocks), [map.id, map.blocks])
  // Visual groups + collider. raycast groups (beam targets) get a BVH (computeBoundsTree) — shot raycast O(log n).
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

      {/* Floor: plane (visual) + static collider (top at y=0). Beam ignores it (noRaycast). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ noRaycast: true }}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={map.floorColor} />
      </mesh>
      <CuboidCollider args={[hx, 0.5, hz]} position={[0, -0.5, 0]} />

      {/* Invisible tall perimeter walls — can't jump out of the arena (colliders without a mesh). */}
      <CuboidCollider args={[hx, BOUND_H, BOUND_T]} position={[0, BOUND_H, -hz]} />
      <CuboidCollider args={[hx, BOUND_H, BOUND_T]} position={[0, BOUND_H, hz]} />
      <CuboidCollider args={[BOUND_T, BOUND_H, hz]} position={[-hx, BOUND_H, 0]} />
      <CuboidCollider args={[BOUND_T, BOUND_H, hz]} position={[hx, BOUND_H, 0]} />

      {/* 1×1 floor grid (slightly above the floor — no z-fighting). */}
      <lineSegments geometry={gridGeo} position={[0, 0.01, 0]}>
        <lineBasicMaterial color="#555" />
      </lineSegments>

      {/* Cube grid (voxel cell edges of blocks) — optional, per the map's showBlockGrid setting. */}
      {blockGridGeo && (
        <lineSegments geometry={blockGridGeo} userData={{ noRaycast: true }}>
          <lineBasicMaterial color={BLOCK_GRID_COLOR} transparent opacity={BLOCK_GRID_OPACITY} />
        </lineSegments>
      )}

      {/* Map collider: trimesh of impassable blocks. Mesh is for physics ONLY → noRaycast (otherwise the beam
          would hit the invisible collider: Raycaster sees invisible objects). includeInvisible is needed, otherwise
          MeshCollider traverses via traverseVisible and skips the invisible mesh. Beam targets are the visual block meshes below. */}
      <RigidBody type="fixed" colliders={false} includeInvisible>
        <MeshCollider type="trimesh">
          {geos.collider && <mesh geometry={geos.collider} visible={false} userData={{ noRaycast: true }} />}
        </MeshCollider>
      </RigidBody>

      {/* Block visuals: up to 4 merged meshes. raycast groups are beam targets (no noRaycast). baseOpacity — for World.setBlocksTransparent. */}
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

      {/* Screen-space outline of visible cover edges (post-processing — toggled in settings) */}
      {postFx && <MapEdges />}
    </>
  )
}
