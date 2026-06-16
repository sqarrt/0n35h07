import { BufferGeometry, Float32BufferAttribute } from 'three'
import { unitWedgeGeometry } from './wedge'
import { bucketedBlockGeometries } from './blockGeometry'
import type { MapBlock } from './maps'

/**
 * Компиляция геометрии карты в готовые массивы вершин и обратно. Визуал — 4 группы по (blocksBeam × transparent),
 * collider — отдельная геометрия непроходимых блоков. Цель — не мёржить блоки в рантайме: редактор компилирует
 * при сохранении (geo.json), рантайм строит лёгкую BufferGeometry. Фолбэк — компиляция из blocks (кеш по id).
 */
export interface GeoArrays { position: Float32Array; normal: Float32Array; color: Float32Array }
export interface CompiledMap {
  opaqueRaycast: GeoArrays | null
  opaqueNoRaycast: GeoArrays | null
  transparentRaycast: GeoArrays | null
  transparentNoRaycast: GeoArrays | null
  collider: GeoArrays | null
}

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
  const b = bucketedBlockGeometries(blocks, wedgeGeo, wedgeGeoFlip)
  const out: CompiledMap = {
    opaqueRaycast: toArrays(b.opaqueRaycast),
    opaqueNoRaycast: toArrays(b.opaqueNoRaycast),
    transparentRaycast: toArrays(b.transparentRaycast),
    transparentNoRaycast: toArrays(b.transparentNoRaycast),
    collider: toArrays(b.collider),
  }
  b.opaqueRaycast?.dispose(); b.opaqueNoRaycast?.dispose()
  b.transparentRaycast?.dispose(); b.transparentNoRaycast?.dispose(); b.collider?.dispose()
  wedgeGeo.dispose(); wedgeGeoFlip.dispose()
  return out
}

/** Все группы пусты (нет геометрии) — напр. карта без блоков ИЛИ устаревший формат geo.json (старые ключи). */
export function isEmptyCompiled(c: CompiledMap): boolean {
  return !c.opaqueRaycast && !c.opaqueNoRaycast && !c.transparentRaycast && !c.transparentNoRaycast && !c.collider
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
interface SerCompiled {
  opaqueRaycast: SerGeo; opaqueNoRaycast: SerGeo
  transparentRaycast: SerGeo; transparentNoRaycast: SerGeo
  collider: SerGeo
}

const serGroup = (a: GeoArrays | null): SerGeo => a && { position: b64(a.position), normal: b64(a.normal), color: b64(a.color) }
const parseGroup = (s: SerGeo): GeoArrays | null => s && { position: unb64(s.position), normal: unb64(s.normal), color: unb64(s.color) }

export function serializeGeo(c: CompiledMap): string {
  return JSON.stringify({
    opaqueRaycast: serGroup(c.opaqueRaycast), opaqueNoRaycast: serGroup(c.opaqueNoRaycast),
    transparentRaycast: serGroup(c.transparentRaycast), transparentNoRaycast: serGroup(c.transparentNoRaycast),
    collider: serGroup(c.collider),
  } satisfies SerCompiled)
}
/** Разобрать загруженный geo.json (объект или строку) в массивы. */
export function parseGeo(data: SerCompiled | string): CompiledMap {
  const s = (typeof data === 'string' ? JSON.parse(data) : data) as SerCompiled
  return {
    opaqueRaycast: parseGroup(s.opaqueRaycast), opaqueNoRaycast: parseGroup(s.opaqueNoRaycast),
    transparentRaycast: parseGroup(s.transparentRaycast), transparentNoRaycast: parseGroup(s.transparentNoRaycast),
    collider: parseGroup(s.collider),
  }
}

// --- рантайм-кеш фолбэк-компиляции по id (чтобы не мёржить повторно при отсутствии артефакта) ---
const cache = new Map<string, CompiledMap>()
export function compileBlocksCached(id: string, blocks: MapBlock[]): CompiledMap {
  let c = cache.get(id)
  if (!c) { c = compileBlocks(blocks); cache.set(id, c) }
  return c
}
