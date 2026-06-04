import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MapScene } from './MapPreview'
import { MAPS } from '../game/maps'
import type { MapId } from '../constants'

/** Перерисовать статичный (frameloop=demand) фон при смене карты. */
function Invalidate({ dep }: { dep: string }) {
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => { invalidate() }, [dep, invalidate])
  return null
}

/**
 * Размытое 3D-превью выбранной карты на весь экран — атмосферный фон ЗА шарами (MenuBackdrop сверху, резкий).
 * Блюр — CSS на DOM-канвасе (без пост-эффектов); demand-рендер (карта статична, перерисовка при смене mapId).
 * Фейдin/out через opacity-transition: `show` → видим; на маунте 0→1, при show=false 1→0 (родитель держит
 * смонтированным на время фейда — useDelayedUnmount).
 */
export function MapBackground({ mapId, show }: { mapId: MapId; show: boolean }) {
  const [visible, setVisible] = useState(false)   // стартуем прозрачными → transition даёт fade-in
  const [ready, setReady] = useState(false)       // отложенный маунт WebGL — чтобы лобби открылось без фриза
  useEffect(() => { setVisible(show) }, [show])
  // Инициализацию канваса (создание GL-контекста + компиляция шейдеров) откладываем за первый кадр лобби,
  // чтобы интерфейс не подвисал в момент открытия. Фон проявится фейдом чуть позже — это фон, не критично.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div className={`map-bg${visible && ready ? ' is-visible' : ''}`}>
      {ready && (
        <Canvas
          frameloop="demand"
          dpr={0.5}                /* фон размыт → низкий dpr незаметен, но дешевле рендер/инициализация */
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
          camera={{ position: [0, 16, 24], fov: 50 }}
          onCreated={({ camera }) => camera.lookAt(0, 2, 0)}
        >
          <MapScene map={MAPS[mapId]} />
          <Invalidate dep={mapId} />
        </Canvas>
      )}
    </div>
  )
}
