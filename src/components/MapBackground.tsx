import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import type { WebGLRenderer } from 'three'
import { MapScene } from './MapPreview'
import { MAPS } from '../game/maps'
import type { MapId } from '../constants'

const SWITCH_FADE_MS = 320   // кроссфейд при смене карты

/** Перерисовать статичный (frameloop=demand) фон при смене карты. */
function Invalidate({ dep }: { dep: string }) {
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => { invalidate() }, [dep, invalidate])
  return null
}

/**
 * Размытое 3D-превью выбранной карты на весь экран — атмосферный фон ЗА шарами (MenuBackdrop сверху, резкий).
 * Один WebGL-контекст (перф). Вход/выход лобби — opacity-фейд всего слоя (`show`, CSS 0.7s).
 * Смена карты — кроссфейд БЕЗ провала в пустоту: снимок текущего кадра (старая арена) кладём поверх, под ним
 * канвас перерисовывает новую арену, и снимок плавно гаснет → переход одной арены в другую.
 * GL инициализируется отложенно (после первого кадра лобби) — без фриза на открытии.
 */
export function MapBackground({ mapId, show }: { mapId: MapId; show: boolean }) {
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

  // Смена карты — кроссфейд через снимок старого кадра.
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
          dpr={0.5}                /* фон размыт → низкий dpr незаметен, но дешевле рендер/инициализация */
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true }}
          camera={{ position: [0, 16, 24], fov: 50 }}
          onCreated={({ gl, camera }) => { glRef.current = gl; camera.lookAt(0, 2, 0) }}
        >
          <MapScene map={MAPS[drawnMap]} />
          <Invalidate dep={drawnMap} />
        </Canvas>
      )}
      {snapshot && <img key={snapshot.key} className="map-bg-snap" src={snapshot.url} alt="" />}
    </div>
  )
}
