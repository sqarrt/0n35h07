import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MapScene } from './MapPreview'
import { MAPS } from '../game/maps'
import type { MapId } from '../constants'

const ENTER_FADE_MS = 700    // вход/выход из лобби (синхронно с MAP_FADE_MS в App)
const SWITCH_FADE_MS = 260   // смена карты внутри лобби — быстрее, чтобы клики по плиткам были отзывчивы

/** Перерисовать статичный (frameloop=demand) фон при смене карты. */
function Invalidate({ dep }: { dep: string }) {
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => { invalidate() }, [dep, invalidate])
  return null
}

/**
 * Размытое 3D-превью выбранной карты на весь экран — атмосферный фон ЗА шарами (MenuBackdrop сверху, резкий).
 * Блюр — CSS на DOM-канвасе; demand-рендер. Фейды через opacity-transition (длительность задаётся инлайн):
 *  - вход/выход лобби (`show`) — ENTER_FADE_MS;
 *  - смена карты — fade-through (гаснем → подменяем геометрию скрытно → проявляем) за SWITCH_FADE_MS.
 * Инициализацию GL откладываем за первый кадр лобби (без фриза на открытии).
 */
export function MapBackground({ mapId, show }: { mapId: MapId; show: boolean }) {
  const [ready, setReady] = useState(false)            // отложенный маунт WebGL
  const [visible, setVisible] = useState(false)        // is-visible → opacity 1
  const [drawnMap, setDrawnMap] = useState<MapId>(mapId)   // карта, реально нарисованная сейчас
  const [fadeMs, setFadeMs] = useState(ENTER_FADE_MS)

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  // Вход/выход лобби.
  useEffect(() => { setFadeMs(ENTER_FADE_MS); setVisible(show) }, [show])

  // Смена карты — fade-through: гаснем, затем (скрытно) меняем геометрию и проявляем заново.
  useEffect(() => {
    if (mapId === drawnMap) return
    setFadeMs(SWITCH_FADE_MS)
    setVisible(false)
    const t = setTimeout(() => { setDrawnMap(mapId); setVisible(true) }, SWITCH_FADE_MS)
    return () => clearTimeout(t)
  }, [mapId, drawnMap])

  return (
    <div className={`map-bg${visible && ready ? ' is-visible' : ''}`} style={{ transitionDuration: `${fadeMs}ms` }}>
      {ready && (
        <Canvas
          frameloop="demand"
          dpr={0.5}                /* фон размыт → низкий dpr незаметен, но дешевле рендер/инициализация */
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
          camera={{ position: [0, 16, 24], fov: 50 }}
          onCreated={({ camera }) => camera.lookAt(0, 2, 0)}
        >
          <MapScene map={MAPS[drawnMap]} />
          <Invalidate dep={drawnMap} />
        </Canvas>
      )}
    </div>
  )
}
