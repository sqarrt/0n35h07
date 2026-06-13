import * as THREE from 'three'

// Рисунок на шаре: два круглых поля 32×32 (перёд/зад). Бит на клетку (1 = закрашено чёрным).
// Кодек и дисковая параметризация НЕ зависят от THREE — тестируются без рендера; THREE нужен только
// для buildArtTexture (сборка DataTexture). Дисковая (азимутальная) проекция: центр диска = полюс
// полусферы, край r=1 = силуэт шара; перёд = полусфера, обращённая к прицелу (локальная −Z).

export const BALL_ART_SIZE = 16
export const BALL_ART_CELLS = BALL_ART_SIZE * BALL_ART_SIZE   // 256 клеток на сторону
const BYTES_PER_SIDE = BALL_ART_CELLS / 8                     // 32 байта на сторону
const BALL_ART_BYTES = BYTES_PER_SIDE * 2                     // 64 байта всего
const BASE64_LEN = Math.ceil(BALL_ART_BYTES / 3) * 4          // длина base64 (64 байта → 88 символов)

export const ART_TEX_W = BALL_ART_SIZE * 2   // 32: перёд|зад в одной текстуре
export const ART_TEX_H = BALL_ART_SIZE       // 16

const HALF = BALL_ART_SIZE / 2               // 16: центр диска в координатах сетки
const HALF_PI = Math.PI / 2

export interface BallArt { front: Uint8Array; back: Uint8Array }

export function makeEmptyArt(): BallArt {
  return { front: new Uint8Array(BALL_ART_CELLS), back: new Uint8Array(BALL_ART_CELLS) }
}

export function isEmpty(art: BallArt): boolean {
  return !art.front.some(v => v) && !art.back.some(v => v)
}

// --- кодек base64 (без THREE) ---

/** Упаковать сторону в байты (бит i байта b = клетка b*8+i). */
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

// --- дисковая параметризация (без THREE) ---

/** Клетка (cx,cy) внутри вписанного в сетку круга? Нормированный радиус центра клетки ≤ 1. */
export function cellInDisc(cx: number, cy: number): boolean {
  const dx = (cx + 0.5 - HALF) / HALF
  const dy = (cy + 0.5 - HALF) / HALF
  return dx * dx + dy * dy <= 1
}

/**
 * Точная копия выборки рисунка из фрагментного шейдера (для юнит-теста соответствия).
 * Модельная нормаль → uv в текстуре 64×32 ([0,1]×[0,1]): перёд u∈[0,0.5], зад u∈[0.5,1].
 * Азимутальная равнопромежуточная проекция: r = угол_от_полюса / (π/2).
 */
export function artUvForNormal(nx: number, ny: number, nz: number): { u: number; v: number } {
  const isFront = nz <= 0 ? 1 : 0
  const ang = Math.acos(Math.min(1, Math.abs(nz)))     // [0, π/2]
  const r = ang / HALF_PI
  // перёд зеркалит x: полусферу смотрят снаружи, без зеркала рисунок читается отражённым
  const phi = Math.atan2(ny, isFront ? -nx : nx)
  const dx = 0.5 + 0.5 * r * Math.cos(phi)
  const dy = 0.5 + 0.5 * r * Math.sin(phi)
  return { u: dx * 0.5 + (1 - isFront) * 0.5, v: dy }
}

// --- сборка текстуры (THREE) ---

/** Заполнить RGBA-буфер (ART_TEX_W×ART_TEX_H×4) из рисунка: закрашено→0 (чёрный множитель), пусто→255. */
export function writeArtData(art: BallArt | null, data: Uint8Array) {
  for (let cy = 0; cy < BALL_ART_SIZE; cy++) {
    const ty = BALL_ART_SIZE - 1 - cy               // флип: верх редактора = верх шара
    for (let cx = 0; cx < BALL_ART_SIZE; cx++) {
      const front = art ? art.front[cy * BALL_ART_SIZE + cx] : 0
      const back = art ? art.back[cy * BALL_ART_SIZE + cx] : 0
      const fi = (ty * ART_TEX_W + cx) * 4
      const bi = (ty * ART_TEX_W + BALL_ART_SIZE + cx) * 4
      const fv = front ? 0 : 255
      const bv = back ? 0 : 255
      data[fi] = data[fi + 1] = data[fi + 2] = fv; data[fi + 3] = 255
      data[bi] = data[bi + 1] = data[bi + 2] = bv; data[bi + 3] = 255
    }
  }
}

/** DataTexture рисунка (64×32, NearestFilter, без мипмапов). `art=null/пусто` → белая (множитель 1). */
export function buildArtTexture(art: BallArt | null): THREE.DataTexture {
  const data = new Uint8Array(ART_TEX_W * ART_TEX_H * 4)
  writeArtData(art, data)
  const tex = new THREE.DataTexture(data, ART_TEX_W, ART_TEX_H, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}
