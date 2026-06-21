import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import type { GameMap } from '../game/maps'
import { compileBlocks, buildGeometry } from '../game/mapGeometryCache'
import { MapLights } from './MapVisualBits'
import { MapEdges, BLOCK_LAYER } from './EdgeOutline'
import { loadProfile } from '../settings'

const PREVIEW_W = 150
const PREVIEW_H = 100

/**
 * Map geometry (floor + blocks) without physics/players — for offscreen preview render on save and as a fallback
 * when the map has no preview.png yet. Compiled from the current blocks (reflects the editor's latest edits).
 */
export function MapScene({ map }: { map: GameMap }) {
  const [hx, hz] = map.half
  const compiled = useMemo(() => compileBlocks(map.blocks), [map.blocks])
  // Top-down preview — transparency/collision don't matter: draw all 4 visual groups opaquely.
  const geos = useMemo(() => [compiled.opaqueRaycast, compiled.opaqueNoRaycast, compiled.transparentRaycast, compiled.transparentNoRaycast]
    .map(a => (a ? buildGeometry(a) : null)), [compiled])
  useEffect(() => () => geos.forEach(g => g?.dispose()), [geos])
  const postFx = useMemo(() => loadProfile().postProcessing, [])
  return (
    <>
      <MapLights />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={map.floorColor} />
      </mesh>
      {geos.map((g, i) => g && <mesh key={i} geometry={g} onUpdate={o => o.layers.enable(BLOCK_LAYER)}><meshStandardMaterial vertexColors /></mesh>)}
      {postFx && <MapEdges />}
    </>
  )
}

/**
 * Frames the camera to the map's size (rectangular/long maps must not be cropped) and redraws
 * (frameloop=demand) on map switch. `lift` — how much higher/farther the camera is (preview steeper from above, background lower).
 */
export function FitCamera({ map, lift }: { map: GameMap; lift: number }) {
  const camera = useThree(s => s.camera)
  const invalidate = useThree(s => s.invalidate)
  const [hx, hz] = map.half
  useEffect(() => {
    const reach = Math.max(hx, hz)
    camera.position.set(0, reach * lift, reach * (lift + 0.15))
    camera.lookAt(0, 0, 0)
    invalidate()
  }, [hx, hz, lift, camera, invalidate])
  return null
}

/**
 * A real angled 3D map preview (not a schematic): renders the map geometry from the same data as the arena.
 * frameloop="demand" → one static frame (cheap, like a "screenshot", but always up to date); camera fit to size.
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
      camera={{ fov: 45 }}
    >
      <MapScene map={map} />
      <FitCamera map={map} lift={1.7} />
    </Canvas>
  )
}

const THUMB_W = 1024   // larger — the image also serves as the room's fullscreen background (upscale must not look crusty)
const THUMB_H = 640

/** Captures a frame after a few renders (the composer needs to draw) → PNG dataURL. */
function Capture({ onReady }: { onReady: (dataUrl: string | null) => void }) {
  const gl = useThree(s => s.gl)
  const frames = useRef(0)
  useFrame(() => {
    frames.current++
    if (frames.current === 3) {
      try { onReady(gl.domElement.toDataURL('image/png')) } catch { onReady(null) }
    }
  })
  return null
}

/**
 * Offscreen map render (with outline) → PNG for preview.png. Mounted by the editor during save,
 * calls onCapture after the capture. preserveDrawingBuffer — so toDataURL returns pixels.
 */
export function ThumbnailRenderer({ map, onCapture }: { map: GameMap; onCapture: (dataUrl: string | null) => void }) {
  return (
    <div style={{ position: 'fixed', left: -10000, top: 0, width: THUMB_W, height: THUMB_H, pointerEvents: 'none' }} aria-hidden>
      <Canvas
        dpr={1}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        style={{ width: THUMB_W, height: THUMB_H }}
        camera={{ fov: 45 }}
      >
        <MapScene map={map} />
        <FitCamera map={map} lift={1.7} />
        <Capture onReady={onCapture} />
      </Canvas>
    </div>
  )
}
