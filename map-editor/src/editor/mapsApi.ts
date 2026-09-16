import { serializeMap, parseMap } from './editorStore'
import type { MapData } from './editorStore'

/**
 * Client for the map dev bridge (bridge/mapsBridge.ts): a map is the three files the game reads —
 * maps/<id>.json (source), maps/<id>_geo.json (compiled geometry), assets/maps/previews/<id>.png (render).
 * Works only under `npm run dev`.
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

/** Rename: the bridge moves all three files at once — the game cannot open a map whose geometry was left behind. */
export async function renameMap(oldId: string, newId: string): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${enc(oldId)}?rename=${enc(newId)}`, { method: 'POST' })
    if (!r.ok) return false
    const map = await loadMap(newId)
    return map ? await saveMap(newId, { ...map, id: newId }) : false   // the id inside the file follows the name
  } catch { return false }
}

async function put(pathPart: string, body: string, contentType: string, keepalive = false): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${pathPart}`, { method: 'PUT', headers: { 'content-type': contentType }, body, keepalive })
    return r.ok
  } catch { return false }
}
