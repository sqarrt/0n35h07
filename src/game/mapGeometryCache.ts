import { BufferGeometry, Float32BufferAttribute } from 'three'
import { unitWedgeGeometry } from './wedge'
import { mergedBlockGeometries } from './blockGeometry'
import type { MapBlock } from './maps'

/**
 * Компиляция геометрии карты в готовые массивы вершин (raycast — укрытия, noRaycast — периметр) и обратно.
 * Цель — не мёржить блоки в рантайме: редактор компилирует при сохранении (geo.json), рантайм строит лёгкую
 * BufferGeometry из массивов. Фолбэк — компиляция из blocks на лету (с кешем по id).
 */
export interface GeoArrays { position: Float32Array; normal: Float32Array; color: Float32Array }
export interface CompiledMap { raycast: GeoArrays | null; noRaycast: GeoArrays | null }

function toArrays(g: BufferGeometry | null): GeoArrays | null {
  if (!g) return null
  const pos = g.getAttribute('position'), nrm = g.getAttribute('normal'), col = g.getAttribute('color')
  return {
    position: new Float32Array(pos.array as Float32Array),
    normal: new Float32Array((nrm?.array ?? new Float32Array()) as Float32Array),
    color: new Float32Array((col?.array ?? new Float32Array()) as Float32Array),
  }
}

/** Слить блоки и извлечь массивы (CPU, без GL). */
export function compileBlocks(blocks: MapBlock[]): CompiledMap {
  const wedgeGeo = unitWedgeGeometry()
  const wedgeGeoFlip = unitWedgeGeometry(true)
  const { raycast, noRaycast } = mergedBlockGeometries(blocks, wedgeGeo, wedgeGeoFlip)
  const out: CompiledMap = { raycast: toArrays(raycast), noRaycast: toArrays(noRaycast) }
  raycast?.dispose(); noRaycast?.dispose(); wedgeGeo.dispose(); wedgeGeoFlip.dispose()
  return out
}

/** BufferGeometry из готовых массивов (дёшево, per-context). */
export function buildGeometry(a: GeoArrays): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(a.position, 3))
  if (a.normal.length) g.setAttribute('normal', new Float32BufferAttribute(a.normal, 3))
  if (a.color.length) g.setAttribute('color', new Float32BufferAttribute(a.color, 3))
  return g
}

// --- сериализация geo.json (base64 Float32 — компактно и быстро парсится) ---
const CHUNK = 0x8000
function b64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
  let bin = ''
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}
function unb64(s: string): Float32Array {
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

type SerGeo = { position: string; normal: string; color: string } | null
interface SerCompiled { raycast: SerGeo; noRaycast: SerGeo }

const serGroup = (a: GeoArrays | null): SerGeo => a && { position: b64(a.position), normal: b64(a.normal), color: b64(a.color) }
const parseGroup = (s: SerGeo): GeoArrays | null => s && { position: unb64(s.position), normal: unb64(s.normal), color: unb64(s.color) }

export function serializeGeo(c: CompiledMap): string {
  return JSON.stringify({ raycast: serGroup(c.raycast), noRaycast: serGroup(c.noRaycast) } satisfies SerCompiled)
}
/** Разобрать загруженный geo.json (объект или строку) в массивы. */
export function parseGeo(data: SerCompiled | string): CompiledMap {
  const s = (typeof data === 'string' ? JSON.parse(data) : data) as SerCompiled
  return { raycast: parseGroup(s.raycast), noRaycast: parseGroup(s.noRaycast) }
}

// --- рантайм-кеш фолбэк-компиляции по id (чтобы не мёржить повторно при отсутствии артефакта) ---
const cache = new Map<string, CompiledMap>()
export function compileBlocksCached(id: string, blocks: MapBlock[]): CompiledMap {
  let c = cache.get(id)
  if (!c) { c = compileBlocks(blocks); cache.set(id, c) }
  return c
}
