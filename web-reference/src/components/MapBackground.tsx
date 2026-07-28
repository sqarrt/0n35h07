import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import type { WebGLRenderer } from 'three'
import { MapScene, FitCamera } from './MapPreview'
import { MAPS, MAP_PREVIEW } from '../game/maps'
import type { MapId } from '../constants'

const SWITCH_FADE_MS = 320   // crossfade on map switch

interface BgProps { mapId: MapId; show: boolean }

/**
 * Blurred fullscreen preview of the selected map — an atmospheric background BEHIND the spheres. If the map has
 * a ready render (preview.png) we show `<img>` (no live WebGL, instant); otherwise the fallback is a live Canvas.
 * Room enter/exit — an opacity fade of the whole layer (`show`, CSS). Map switch — a crossfade with no gap into void.
 */
export function MapBackground(props: BgProps) {
  return MAP_PREVIEW[props.mapId] ? <MapBackgroundImage {...props} /> : <MapBackgroundCanvas {...props} />
}

/** Image background: base layer + a fading snapshot of the old map on switch. */
function MapBackgroundImage({ mapId, show }: BgProps) {
  const [base, setBase] = useState<MapId>(mapId)
  const [fade, setFade] = useState<{ url: string; key: number } | null>(null)
  const keyRef = useRef(0)

  useEffect(() => {
    if (mapId === base) return
    const prev = MAP_PREVIEW[base]
    if (prev) setFade({ url: prev, key: ++keyRef.current })
    setBase(mapId)
    const t = setTimeout(() => setFade(null), SWITCH_FADE_MS + 60)
    return () => clearTimeout(t)
  }, [mapId, base])

  return (
    <div className={`map-bg${show ? ' is-visible' : ''}`}>
      <img className="map-bg-img" src={MAP_PREVIEW[base]} alt="" />
      {fade && <img key={fade.key} className="map-bg-img map-bg-snap" src={fade.url} alt="" />}
    </div>
  )
}

/** Fallback: a live Canvas (map without preview.png). GL inits lazily (no freeze on open). */
function MapBackgroundCanvas({ mapId, show }: BgProps) {
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const [drawnMap, setDrawnMap] = useState<MapId>(mapId)
  const [snapshot, setSnapshot] = useState<{ url: string; key: number } | null>(null)
  const glRef = useRef<WebGLRenderer | null>(null)
  const snapKey = useRef(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => { setVisible(show) }, [show])

  useEffect(() => {
    if (mapId === drawnMap) return
    const gl = glRef.current
    if (gl) {
      try { setSnapshot({ url: gl.domElement.toDataURL(), key: ++snapKey.current }) }
      catch { setSnapshot(null) }
    }
    setDrawnMap(mapId)
    const t = setTimeout(() => setSnapshot(null), SWITCH_FADE_MS + 60)
    return () => clearTimeout(t)
  }, [mapId, drawnMap])

  return (
    <div className={`map-bg${visible && ready ? ' is-visible' : ''}`}>
      {ready && (
        <Canvas
          frameloop="demand"
          dpr={0.5}
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true }}
          camera={{ fov: 50 }}
          onCreated={({ gl }) => { glRef.current = gl }}
        >
          <MapScene map={MAPS[drawnMap]} />
          <FitCamera map={MAPS[drawnMap]} lift={0.8} />
        </Canvas>
      )}
      {snapshot && <img key={snapshot.key} className="map-bg-snap" src={snapshot.url} alt="" />}
    </div>
  )
}
