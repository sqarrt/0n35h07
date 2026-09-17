import { useRef, useEffect } from 'react'
import { Vector3 } from 'three'
import type { DirectionalLight } from 'three'

/**
 * Shared visual parts of the map — so the arena looks the same in game, editor, preview, and menu background.
 */

// Light and shadow. A single default shadow.camera (ortho ±5) stretched over a huge area → the arena's far edges
// have no shadows, and within the covered zone the resolution is tiny → shadow-acne as thin lines along block
// face boundaries ("seams"). We fit the frustum EXACTLY: as the arena's AABB in LIGHT coordinates. A symmetric
// ±(half+margin) wouldn't do: the ortho box is centered on the slanted light axis, and the arena's far corners
// fell outside its edges (down to ~-28.5 on light X with a -24 boundary) — wall shadows were clipped by a diagonal line.
const LIGHT_POS: [number, number, number] = [10, 20, 8]
const SHADOW_MAP_SIZE = 2048     // shadow map resolution (above the default 512 → no acne "seams")
const SHADOW_NORMAL_BIAS = 0.03  // shift along the normal — removes self-shadowing (acne) on flat faces
const SHADOW_BIAS        = -0.0005
const DEFAULT_SHADOW_RADIUS = 20 // half-size if the arena size isn't passed (editor/preview)
const SHADOW_PAD      = 2        // padding at the frustum edges in light coordinates
const SHADOW_TOP_Y    = 6        // top of casters: walls (3), blocks, jumping player
const SHADOW_BOTTOM_Y = -1      // bottom of receivers: floor with margin

/** Unified map light (same brightness/direction in all contexts). `half` — arena half-sizes [X,Z]
 *  for precise shadow frustum fitting (Arena passes map.half; editor/preview — default). */
export function MapLights({ half }: { half?: [number, number] } = {}) {
  const ref = useRef<DirectionalLight>(null)

  useEffect(() => {
    const light = ref.current
    if (!light) return
    const [hx, hz] = half ?? [DEFAULT_SHADOW_RADIUS, DEFAULT_SHADOW_RADIUS]
    // Shadow camera axes: looks from LIGHT_POS at the arena center (three builds it the same way in updateMatrices).
    const lightPos = new Vector3(...LIGHT_POS)
    const zAxis = lightPos.clone().normalize()                            // from target (0,0,0) to the light
    const xAxis = new Vector3().crossVectors(new Vector3(0, 1, 0), zAxis).normalize()
    const yAxis = new Vector3().crossVectors(zAxis, xAxis)
    // Light-space AABB over the 8 corners of the arena box (floor → top of casters).
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minD = Infinity, maxD = -Infinity
    const v = new Vector3()
    for (const cx of [-hx, hx]) for (const cy of [SHADOW_BOTTOM_Y, SHADOW_TOP_Y]) for (const cz of [-hz, hz]) {
      v.set(cx, cy, cz).sub(lightPos)
      const lx = v.dot(xAxis), ly = v.dot(yAxis), d = -v.dot(zAxis)       // d — depth along the view
      minX = Math.min(minX, lx); maxX = Math.max(maxX, lx)
      minY = Math.min(minY, ly); maxY = Math.max(maxY, ly)
      minD = Math.min(minD, d);  maxD = Math.max(maxD, d)
    }
    const cam = light.shadow.camera
    cam.left = minX - SHADOW_PAD; cam.right = maxX + SHADOW_PAD
    cam.bottom = minY - SHADOW_PAD; cam.top = maxY + SHADOW_PAD
    cam.near = Math.max(0.1, minD - SHADOW_PAD); cam.far = maxD + SHADOW_PAD
    cam.updateProjectionMatrix()
    light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
    light.shadow.normalBias = SHADOW_NORMAL_BIAS
    light.shadow.bias = SHADOW_BIAS
    // The shadow map may have been created with the default size before this effect — reset it so it's recreated.
    if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null }
    light.shadow.needsUpdate = true
  }, [half])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight ref={ref} position={LIGHT_POS} intensity={1.05} castShadow />
    </>
  )
}
