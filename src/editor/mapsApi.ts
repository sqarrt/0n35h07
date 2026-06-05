import { serializeMap, parseMap } from './editorStore'
import type { MapData } from './editorStore'

/**
 * Клиент dev-мостика карт (vite-plugin-editor-maps): список/чтение/запись JSON-карт в src/maps.
 * Работает только при `npm run dev` (редактор и так dev-only).
 */
const BASE = '/__maps'

export async function listMaps(): Promise<string[]> {
  try {
    const r = await fetch(BASE)
    return r.ok ? (await r.json()) as string[] : []
  } catch { return [] }
}

export async function loadMap(name: string): Promise<MapData | null> {
  try {
    const r = await fetch(`${BASE}/${encodeURIComponent(name)}`)
    return r.ok ? parseMap(await r.text()) : null
  } catch { return null }
}

export async function saveMap(name: string, map: MapData): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: serializeMap(map),
    })
    return r.ok
  } catch { return false }
}

export async function deleteMap(name: string): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/${encodeURIComponent(name)}`, { method: 'DELETE' })
    return r.ok
  } catch { return false }
}

/** Переименование: читаем старую карту, пишем под новым именем (с обновлённым id) и удаляем старую. */
export async function renameMap(oldName: string, newName: string): Promise<boolean> {
  const data = await loadMap(oldName)
  if (!data) return false
  const ok = await saveMap(newName, { ...data, id: newName })
  if (!ok) return false
  return deleteMap(oldName)
}
