// Ball art: two round 16×16 fields (front/back). One bit per cell (1 = filled black).
// The codec and disc parameterization don't depend on THREE — tested without rendering.
// THREE-dependent code (buildArtTexture, writeArtData) lives in fx/artTexture.ts.
// Disc (azimuthal) projection: disc center = hemisphere pole, edge r=1 = ball silhouette;
// front = hemisphere facing the aim (local −Z).

export const BALL_ART_SIZE = 16
export const BALL_ART_CELLS = BALL_ART_SIZE * BALL_ART_SIZE   // 256 cells per side
const BYTES_PER_SIDE = BALL_ART_CELLS / 8                     // 32 bytes per side
const BALL_ART_BYTES = BYTES_PER_SIDE * 2                     // 64 bytes total
const BASE64_LEN = Math.ceil(BALL_ART_BYTES / 3) * 4          // base64 length (64 bytes → 88 chars)

const HALF = BALL_ART_SIZE / 2               // 16: disc center in grid coordinates
const HALF_PI = Math.PI / 2

export interface BallArt { front: Uint8Array; back: Uint8Array }

export function makeEmptyArt(): BallArt {
  return { front: new Uint8Array(BALL_ART_CELLS), back: new Uint8Array(BALL_ART_CELLS) }
}

export function isEmpty(art: BallArt): boolean {
  return !art.front.some(v => v) && !art.back.some(v => v)
}

// --- base64 codec (no THREE) ---

/** Pack a side into bytes (bit i of byte b = cell b*8+i). */
function packSide(side: Uint8Array, out: Uint8Array, offset: number) {
  for (let b = 0; b < BYTES_PER_SIDE; b++) {
    let byte = 0
    for (let i = 0; i < 8; i++) if (side[b * 8 + i]) byte |= 1 << i
    out[offset + b] = byte
  }
}

function unpackSide(bytes: Uint8Array, offset: number, out: Uint8Array) {
  for (let b = 0; b < BYTES_PER_SIDE; b++) {
    const byte = bytes[offset + b]
    for (let i = 0; i < 8; i++) out[b * 8 + i] = (byte >> i) & 1
  }
}

export function encodeBallArt(art: BallArt): string {
  const bytes = new Uint8Array(BALL_ART_BYTES)
  packSide(art.front, bytes, 0)
  packSide(art.back, bytes, BYTES_PER_SIDE)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function decodeBallArt(str: unknown): BallArt | null {
  if (typeof str !== 'string' || str.length !== BASE64_LEN) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(str)) return null
  let bin: string
  try { bin = atob(str) } catch { return null }
  if (bin.length !== BALL_ART_BYTES) return null
  const bytes = new Uint8Array(BALL_ART_BYTES)
  for (let i = 0; i < BALL_ART_BYTES; i++) bytes[i] = bin.charCodeAt(i)
  const art = makeEmptyArt()
  unpackSide(bytes, 0, art.front)
  unpackSide(bytes, BYTES_PER_SIDE, art.back)
  return art
}

// --- disc parameterization (no THREE) ---

/** Is cell (cx,cy) inside the circle inscribed in the grid? Normalized radius of cell center ≤ 1. */
export function cellInDisc(cx: number, cy: number): boolean {
  const dx = (cx + 0.5 - HALF) / HALF
  const dy = (cy + 0.5 - HALF) / HALF
  return dx * dx + dy * dy <= 1
}

/**
 * Exact replica of the art sampling from the fragment shader (for a parity unit test).
 * Model normal → uv in the 64×32 texture ([0,1]×[0,1]): front u∈[0,0.5], back u∈[0.5,1].
 * Azimuthal equidistant projection: r = angle_from_pole / (π/2).
 */
export function artUvForNormal(nx: number, ny: number, nz: number): { u: number; v: number } {
  const isFront = nz <= 0 ? 1 : 0
  const ang = Math.acos(Math.min(1, Math.abs(nz)))     // [0, π/2]
  const r = ang / HALF_PI
  // front mirrors x: the hemisphere is viewed from outside; without mirroring the art reads reversed
  const phi = Math.atan2(ny, isFront ? -nx : nx)
  const dx = 0.5 + 0.5 * r * Math.cos(phi)
  const dy = 0.5 + 0.5 * r * Math.sin(phi)
  return { u: dx * 0.5 + (1 - isFront) * 0.5, v: dy }
}

