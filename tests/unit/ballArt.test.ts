import { describe, it, expect } from 'vitest'
import {
  BALL_ART_SIZE, makeEmptyArt, encodeBallArt, decodeBallArt, isEmpty,
  cellInDisc, artUvForNormal,
} from '../../src/game/ballArt'
import { writeArtData, ART_TEX_W, ART_TEX_H } from '../../src/game/fx/artTexture'

describe('ballArt codec', () => {
  it('round-trip: encode→decode сохраняет закрашенные клетки', () => {
    const art = makeEmptyArt()
    art.front[8 * BALL_ART_SIZE + 8] = 1
    art.back[0] = 1
    const decoded = decodeBallArt(encodeBallArt(art))!
    expect(decoded).not.toBeNull()
    expect(decoded.front[8 * BALL_ART_SIZE + 8]).toBe(1)
    expect(decoded.back[0]).toBe(1)
    expect(decoded.front[0]).toBe(0)
  })

  it('encode даёт строку длиной 88 (64 байта base64)', () => {
    expect(encodeBallArt(makeEmptyArt()).length).toBe(88)
  })

  it('decode отвергает мусор → null', () => {
    expect(decodeBallArt('')).toBeNull()
    expect(decodeBallArt('not-base64-$$$')).toBeNull()
    expect(decodeBallArt('AAAA')).toBeNull()            // неверная длина
    expect(decodeBallArt(undefined)).toBeNull()
    expect(decodeBallArt(123 as unknown)).toBeNull()
  })

  it('isEmpty: пустой арт — true, с одной клеткой — false', () => {
    const art = makeEmptyArt()
    expect(isEmpty(art)).toBe(true)
    art.front[10] = 1
    expect(isEmpty(art)).toBe(false)
  })
})

describe('ballArt disc geometry', () => {
  it('cellInDisc: центр внутри, угол снаружи', () => {
    expect(cellInDisc(8, 8)).toBe(true)
    expect(cellInDisc(0, 0)).toBe(false)        // угол сетки вне вписанного круга
    expect(cellInDisc(15, 15)).toBe(false)
  })

  it('artUvForNormal: полюс −Z → центр переднего диска (u≈0.25, v≈0.5)', () => {
    const uv = artUvForNormal(0, 0, -1)
    expect(uv.u).toBeCloseTo(0.25, 2)
    expect(uv.v).toBeCloseTo(0.5, 2)
  })

  it('artUvForNormal: полюс +Z → центр заднего диска (u≈0.75)', () => {
    const uv = artUvForNormal(0, 0, 1)
    expect(uv.u).toBeCloseTo(0.75, 2)
    expect(uv.v).toBeCloseTo(0.5, 2)
  })

  it('artUvForNormal: силуэт (+Y, n.z=0) → край диска по вертикали (v≈1)', () => {
    const uv = artUvForNormal(0, 1, 0)
    expect(uv.v).toBeCloseTo(1, 1)
  })
})

describe('ballArt texture data', () => {
  it('writeArtData: закрашенная клетка (8,7) перёд → texel (8,8) = 0, остальное 255', () => {
    const art = makeEmptyArt()
    art.front[7 * BALL_ART_SIZE + 8] = 1                    // cy=7, cx=8
    const data = new Uint8Array(ART_TEX_W * ART_TEX_H * 4)
    writeArtData(art, data)
    const ty = BALL_ART_SIZE - 1 - 7                        // 8 (флип)
    const idx = (ty * ART_TEX_W + 8) * 4
    expect(data[idx]).toBe(0)                               // R закрашенной клетки
    expect(data[idx + 3]).toBe(255)                         // A
    expect(data[0]).toBe(255)                               // незакрашенная клетка — белая
  })

  it('соответствие: artUvForNormal(0,0,-1) указывает на закрашенный texel', () => {
    const art = makeEmptyArt()
    art.front[7 * BALL_ART_SIZE + 8] = 1
    const data = new Uint8Array(ART_TEX_W * ART_TEX_H * 4)
    writeArtData(art, data)
    const uv = artUvForNormal(0, 0, -1)
    const tx = Math.floor(uv.u * ART_TEX_W)
    const ty = Math.floor(uv.v * ART_TEX_H)
    expect(data[(ty * ART_TEX_W + tx) * 4]).toBe(0)
  })
})
