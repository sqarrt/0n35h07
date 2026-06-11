import { useRef, useEffect } from 'react'
import { Vector3 } from 'three'
import type { DirectionalLight } from 'three'

/**
 * Общие визуальные части карты — чтобы арена выглядела одинаково в игре, редакторе, превью и фоне меню.
 */

// Свет и тень. Один дефолтный shadow.camera (ortho ±5) растянут на огромную площадь → у дальних краёв
// арены теней нет, а в покрытой зоне разрешение мизерное → shadow-acne тонкими линиями по границам граней
// блоков («швы»). Фрустум подгоняем ТОЧНО: как AABB арены в СВЕТОВЫХ координатах. Симметричный
// ±(half+margin) не годился: ортобокс центрирован на наклонной оси света, и дальние углы арены вылетали
// за его края (до ~-28.5 по световому X при границе -24) — тени стен обрезались косой линией по границе.
const LIGHT_POS: [number, number, number] = [10, 20, 8]
const SHADOW_MAP_SIZE = 2048     // разрешение карты теней (выше дефолта 512 → нет acne-«швов»)
const SHADOW_NORMAL_BIAS = 0.03  // сдвиг вдоль нормали — убирает самозатенение (acne) на плоских гранях
const SHADOW_BIAS        = -0.0005
const DEFAULT_SHADOW_RADIUS = 20 // полу-размер, если размер арены не передан (редактор/превью)
const SHADOW_PAD      = 2        // запас по краям фрустума в световых координатах
const SHADOW_TOP_Y    = 6        // верх кастеров: стены (3), блоки, игрок в прыжке
const SHADOW_BOTTOM_Y = -1      // низ приёмников: пол с запасом

/** Единый свет карты (одинаковая яркость/направление во всех контекстах). `half` — полу-размеры арены [X,Z]
 *  для точной подгонки фрустума тени (Arena передаёт map.half; редактор/превью — дефолт). */
export function MapLights({ half }: { half?: [number, number] } = {}) {
  const ref = useRef<DirectionalLight>(null)

  useEffect(() => {
    const light = ref.current
    if (!light) return
    const [hx, hz] = half ?? [DEFAULT_SHADOW_RADIUS, DEFAULT_SHADOW_RADIUS]
    // Оси теневой камеры: смотрит из LIGHT_POS в центр арены (three строит её так же в updateMatrices).
    const lightPos = new Vector3(...LIGHT_POS)
    const zAxis = lightPos.clone().normalize()                            // от цели (0,0,0) к свету
    const xAxis = new Vector3().crossVectors(new Vector3(0, 1, 0), zAxis).normalize()
    const yAxis = new Vector3().crossVectors(zAxis, xAxis)
    // Световой AABB по 8 углам бокса арены (пол → верх кастеров).
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minD = Infinity, maxD = -Infinity
    const v = new Vector3()
    for (const cx of [-hx, hx]) for (const cy of [SHADOW_BOTTOM_Y, SHADOW_TOP_Y]) for (const cz of [-hz, hz]) {
      v.set(cx, cy, cz).sub(lightPos)
      const lx = v.dot(xAxis), ly = v.dot(yAxis), d = -v.dot(zAxis)       // d — глубина вдоль взгляда
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
