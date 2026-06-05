import { useRef, useEffect } from 'react'
import type { DirectionalLight } from 'three'

/**
 * Общие визуальные части карты — чтобы арена выглядела одинаково в игре, редакторе, превью и фоне меню.
 */

// Свет и тень. Один дефолтный shadow.camera (ortho ±5) растянут на огромную площадь → у дальних краёв
// арены теней нет, а в покрытой зоне разрешение мизерное → shadow-acne тонкими линиями по границам граней
// блоков («швы»). Тугой фрустум по размеру арены поднимает плотность текселей и расширяет покрытие.
const LIGHT_POS: [number, number, number] = [10, 20, 8]
const SHADOW_MARGIN   = 4        // запас фрустума за пределы арены (учёт наклона света)
const SHADOW_MAP_SIZE = 2048     // разрешение карты теней (выше дефолта 512 → нет acne-«швов»)
const SHADOW_NEAR     = 0.5
const SHADOW_FAR      = 90       // покрывает дистанцию свет→дальний край арены
const SHADOW_NORMAL_BIAS = 0.03  // сдвиг вдоль нормали — убирает самозатенение (acne) на плоских гранях
const SHADOW_BIAS        = -0.0005
const DEFAULT_SHADOW_RADIUS = 20 // если размер арены не передан (редактор/превью)

/** Единый свет карты (одинаковая яркость/направление во всех контекстах). `half` — полу-размеры арены [X,Z]
 *  для точной подгонки фрустума тени (Arena передаёт map.half; редактор/превью — дефолт). */
export function MapLights({ half }: { half?: [number, number] } = {}) {
  const ref = useRef<DirectionalLight>(null)

  useEffect(() => {
    const light = ref.current
    if (!light) return
    const radius = half ? Math.max(half[0], half[1]) + SHADOW_MARGIN : DEFAULT_SHADOW_RADIUS
    const cam = light.shadow.camera
    cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius
    cam.near = SHADOW_NEAR; cam.far = SHADOW_FAR
    cam.updateProjectionMatrix()
    light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
    light.shadow.normalBias = SHADOW_NORMAL_BIAS
    light.shadow.bias = SHADOW_BIAS
    // Карта теней могла создаться с дефолтным размером до этого эффекта — сбросить, чтобы пересоздалась.
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
