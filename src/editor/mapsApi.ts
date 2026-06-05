import { serializeMap, parseMap } from './editorStore'
import type { MapData } from './editorStore'

/**
 * Клиент dev-мостика карт (vite-plugin-editor-maps): каждая карта — папка src/maps/<id>/ с
 * raw.json (исходник), geo.json (компил геометрии), preview.png (рендер). Работает только при `npm run dev`.
 */
const BASE = '/__maps'
const enc = encodeURIComponent

export async function listMaps(): Promise<string[]> {
  try {
    const r = await fetch(BASE)
    return r.ok ? (await r.json()) as string[] : []
  } catch { return [] }
}

export async function loadMap(id: string): Promise<MapData | null> {
  try {
    const r = await fetch(`${BASE}/${enc(id)}/raw.json`)
    return r.ok ? parseMap(await r.text()) : null
  } catch { return null }
}

export async function saveMap(id: string, map: MapData): Promise<boolean> {
  return put(`${enc(id)}/raw.json`, serializeMap(map), 'application/json')
}

/** Компил геометрии (geo.json). */
export async function saveCompiled(id: string, geoJson: string): Promise<boolean> {
  return put(`${enc(id)}/geo.json`, geoJson, 'application/json')
}

/** Картинка превью: dataURL (data:image/png;base64,...) → тело base64. */
export async function saveThumbnail(id: string, dataUrl: string): Promise<boolean> {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  return put(`${enc(id)}/preview.png`, base64, 'text/plain')
}

export async function deleteMap(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${enc(id)}`, { method: 'DELETE' })
    return r.ok
  } catch { return false }
}

/** Переименование: читаем исходник, пишем под новым id и удаляем старую папку (geo/preview перегенерируются при сохранении). */
export async function renameMap(oldId: string, newId: string): Promise<boolean> {
  const data = await loadMap(oldId)
  if (!data) return false
  if (!(await saveMap(newId, { ...data, id: newId }))) return false
  return deleteMap(oldId)
}

async function put(pathPart: string, body: string, contentType: string): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${pathPart}`, { method: 'PUT', headers: { 'content-type': contentType }, body })
    return r.ok
  } catch { return false }
}
