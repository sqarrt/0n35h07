import { BufferGeometry, Float32BufferAttribute } from 'three'
import { unitWedgeGeometry } from './wedge'
import { bucketedBlockGeometries } from './blockGeometry'
import type { MapBlock } from './maps'

/**
 * Compiles map geometry into ready vertex arrays and back. Visual — 4 groups by (blocksBeam × transparent),
 * collider — separate geometry of impassable blocks. Goal — avoid merging blocks at runtime: the editor compiles
 * on save (geo.json), the runtime builds a lightweight BufferGeometry. Fallback — compile from blocks (cached by id).
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

/** Merge blocks and extract arrays (CPU, no GL). */
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

/** All groups empty (no geometry) — e.g. a map with no blocks OR an outdated geo.json format (old keys). */
export function isEmptyCompiled(c: CompiledMap): boolean {
  return !c.opaqueRaycast && !c.opaqueNoRaycast && !c.transparentRaycast && !c.transparentNoRaycast && !c.collider
}

/** BufferGeometry from ready arrays (cheap, per-context). */
export function buildGeometry(a: GeoArrays): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(a.position, 3))
  if (a.normal.length) g.setAttribute('normal', new Float32BufferAttribute(a.normal, 3))
  if (a.color.length) g.setAttribute('color', new Float32BufferAttribute(a.color, 3))
  return g
}

// --- geo.json serialization (base64 Float32 — compact and fast to parse) ---
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
/** Parse a loaded geo.json (object or string) into arrays. */
export function parseGeo(data: SerCompiled | string): CompiledMap {
  const s = (typeof data === 'string' ? JSON.parse(data) : data) as SerCompiled
  return {
    opaqueRaycast: parseGroup(s.opaqueRaycast), opaqueNoRaycast: parseGroup(s.opaqueNoRaycast),
    transparentRaycast: parseGroup(s.transparentRaycast), transparentNoRaycast: parseGroup(s.transparentNoRaycast),
    collider: parseGroup(s.collider),
  }
}

// --- runtime cache of fallback compilation by id (to avoid re-merging when the artifact is missing) ---
const cache = new Map<string, CompiledMap>()
export function compileBlocksCached(id: string, blocks: MapBlock[]): CompiledMap {
  let c = cache.get(id)
  if (!c) { c = compileBlocks(blocks); cache.set(id, c) }
  return c
}
