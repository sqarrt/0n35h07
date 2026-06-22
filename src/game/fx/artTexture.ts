import * as THREE from 'three'
import type { BallArt } from '../ballArt'
import { BALL_ART_SIZE } from '../ballArt'

export const ART_TEX_W = BALL_ART_SIZE * 2   // front|back in one texture
export const ART_TEX_H = BALL_ART_SIZE

/** Fill an RGBA buffer (ART_TEX_W×ART_TEX_H×4) from the art: painted→0 (black multiplier), empty→255. */
export function writeArtData(art: BallArt | null, data: Uint8Array) {
  for (let cy = 0; cy < BALL_ART_SIZE; cy++) {
    const ty = BALL_ART_SIZE - 1 - cy               // flip: editor top = ball top
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

/** DataTexture for the art (32×16, NearestFilter, no mipmaps). `art=null` → white (multiplier 1). */
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
