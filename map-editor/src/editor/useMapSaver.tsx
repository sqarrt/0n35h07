import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import type { GameMap } from '../game/maps'
import { compileBlocks, serializeGeo } from '../game/mapGeometryCache'
import { ThumbnailRenderer } from '../components/MapPreview'
import type { MapData } from './editorStore'
import { saveMap, saveCompiled, saveThumbnail } from './mapsApi'

/**
 * Конвейер сохранения карты: raw.json → geo.json → preview.png (offscreen-рендер через ThumbnailRenderer).
 * Очередь глубиной 1: save() во время записи коалесцируется в один повторный сейв с последними данными —
 * двух параллельных ThumbnailRenderer не бывает. flush() — keepalive-запись raw+geo для pagehide.
 */
export function useMapSaver(name: string): { save: (data: MapData) => void; flush: (data: MapData) => void; status: string; thumbEl: ReactNode } {
  const [status, setStatus] = useState('')
  const [thumbMap, setThumbMap] = useState<GameMap | null>(null)
  const busy = useRef(false)
  const queued = useRef<MapData | null>(null)

  // Завершение цикла: статус + запуск отложенного сейва, если за время записи пришли новые данные.
  const finish = (msg: string) => {
    setStatus(msg)
    busy.current = false
    const next = queued.current
    queued.current = null
    if (next) start(next)
  }

  const start = (data: MapData) => {
    busy.current = true
    setStatus('saving…')
    void (async () => {
      const rawOk = await saveMap(name, data)
      const geoOk = rawOk && await saveCompiled(name, serializeGeo(compileBlocks(data.blocks)))
      if (!geoOk) { finish('save error'); return }
      setThumbMap(data as unknown as GameMap)   // монтирует ThumbnailRenderer → onThumb продолжит цикл
    })()
  }

  const onThumb = (dataUrl: string | null) => {
    setThumbMap(null)
    void (async () => {
      const pngOk = dataUrl ? await saveThumbnail(name, dataUrl) : false
      finish(pngOk ? `saved ${new Date().toLocaleTimeString()}` : 'saved (no preview)')
    })()
  }

  const save = (data: MapData) => {
    if (busy.current) { queued.current = data; return }
    start(data)
  }

  const flush = (data: MapData) => {
    void saveMap(name, data, { keepalive: true })
    void saveCompiled(name, serializeGeo(compileBlocks(data.blocks)), { keepalive: true })
  }

  const thumbEl = thumbMap ? <ThumbnailRenderer map={thumbMap} onCapture={onThumb} /> : null
  return { save, flush, status, thumbEl }
}
