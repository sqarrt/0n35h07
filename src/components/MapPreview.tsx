import { useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import type { GameMap } from '../game/maps'
import { unitWedgeGeometry } from '../game/wedge'
import { mergedBlockGeometries } from '../game/blockGeometry'
import { MapLights } from './MapVisualBits'
import { MapEdges, BLOCK_LAYER } from './EdgeOutline'
import { loadProfile } from '../settings'

const PREVIEW_W = 150
const PREVIEW_H = 100

/** Геометрия карты (пол по её размеру + блоки) без физики/игроков — для 3D-превью и размытого фона. */
export function MapScene({ map }: { map: GameMap }) {
  const [hx, hz] = map.half
  const wedgeGeo = useMemo(() => unitWedgeGeometry(), [])
  const wedgeGeoFlip = useMemo(() => unitWedgeGeometry(true), [])
  // Блоки слиты в две геометрии (как в арене) — превью/фон не тормозят на детальных картах.
  const { raycast, noRaycast } = useMemo(
    () => mergedBlockGeometries(map.blocks, wedgeGeo, wedgeGeoFlip),
    [map.blocks, wedgeGeo, wedgeGeoFlip],
  )
  useEffect(() => () => { raycast?.dispose(); noRaycast?.dispose() }, [raycast, noRaycast])
  const postFx = useMemo(() => loadProfile().postProcessing, [])
  return (
    <>
      <MapLights />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={map.floorColor} />
      </mesh>
      {raycast && <mesh geometry={raycast} onUpdate={o => o.layers.enable(BLOCK_LAYER)}><meshStandardMaterial vertexColors /></mesh>}
      {noRaycast && <mesh geometry={noRaycast}><meshStandardMaterial vertexColors /></mesh>}
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
