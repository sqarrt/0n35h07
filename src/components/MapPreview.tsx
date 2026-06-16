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
 * Геометрия карты (пол + блоки) без физики/игроков — для офскрин-рендера превью при сохранении и как фолбэк,
 * если у карты ещё нет preview.png. Компилируется из текущих blocks (отражает свежие правки редактора).
 */
export function MapScene({ map }: { map: GameMap }) {
  const [hx, hz] = map.half
  const compiled = useMemo(() => compileBlocks(map.blocks), [map.blocks])
  // Превью сверху — прозрачность/коллизия не важны: рисуем все 4 визуальные группы непрозрачно.
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
 * Кадрирует камеру под размер карты (прямоугольные/длинные карты не должны обрезаться) и перерисовывает
 * (frameloop=demand) при смене карты. `lift` — насколько камера выше/дальше (превью круче сверху, фон ниже).
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
 * Реальное 3D-превью карты под углом (а не схема): рендерит геометрию карты из тех же данных, что и арена.
 * frameloop="demand" → один статичный кадр (дёшево, как «скриншот», но всегда актуально); камера под размер.
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

const THUMB_W = 1024   // повыше — картинка идёт и на полноэкранный фон комнаты (апскейл не должен «шакалить»)
const THUMB_H = 640

/** Снимает кадр после нескольких рендеров (композеру нужно отрисоваться) → PNG dataURL. */
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
 * Офскрин-рендер карты (с контуром) → PNG для preview.png. Монтируется редактором на время сохранения,
 * после захвата вызывает onCapture. preserveDrawingBuffer — чтобы toDataURL вернул пиксели.
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
