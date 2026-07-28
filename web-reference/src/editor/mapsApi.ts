import { serializeMap, parseMap } from './editorStore'
import type { MapData } from './editorStore'

/**
 * Client for the map dev bridge (vite-plugin-editor-maps): each map is a folder src/maps/<id>/ with
 * raw.json (source), geo.json (compiled geometry), preview.png (render). Works only under `npm run dev`.
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

export async function saveMap(id: string, map: MapData, opts?: { keepalive?: boolean }): Promise<boolean> {
  return put(`${enc(id)}/raw.json`, serializeMap(map), 'application/json', opts?.keepalive)
}

/** Compiled geometry (geo.json). */
export async function saveCompiled(id: string, geoJson: string, opts?: { keepalive?: boolean }): Promise<boolean> {
  return put(`${enc(id)}/geo.json`, geoJson, 'application/json', opts?.keepalive)
}

/** Бэкап состояния на начало сессии редактора (backup.json). */
export async function loadBackup(id: string): Promise<MapData | null> {
  try {
    const r = await fetch(`${BASE}/${enc(id)}/backup.json`)
    return r.ok ? parseMap(await r.text()) : null
  } catch { return null }
}

export async function saveBackup(id: string, map: MapData): Promise<boolean> {
  return put(`${enc(id)}/backup.json`, serializeMap(map), 'application/json')
}

/** Preview image: dataURL (data:image/png;base64,...) → base64 body. */
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

/** Rename: read the source, write it under the new id and delete the old folder (geo/preview regenerate on save). */
export async function renameMap(oldId: string, newId: string): Promise<boolean> {
  const data = await loadMap(oldId)
  if (!data) return false
  if (!(await saveMap(newId, { ...data, id: newId }))) return false
  return deleteMap(oldId)
}

async function put(pathPart: string, body: string, contentType: string, keepalive = false): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${pathPart}`, { method: 'PUT', headers: { 'content-type': contentType }, body, keepalive })
    return r.ok
  } catch { return false }
}
