import * as THREE from 'three'
import { NAMEPLATE_HEIGHT, NAMEPLATE_SCALE } from '../../constants'

// Canvas texture layout (pixels; drawn once — the plate is static).
const PLATE_W = 256
const PLATE_H = 64
const PLATE_RADIUS = 18
const PLATE_FONT = 'bold 34px monospace'
const PLATE_TEXT_COLOR = '#0a0d14'   // dark on a bright team/neutral background
const PLATE_BG_ALPHA = 0.85
const MAX_NAME_CHARS = 12

/** Billboard name plate over a remote player: the background carries the TEAM color (2v2) or a neutral
 *  one (FFA). Never a raycast target; the owner hides it together with the body (death/leave). */
export function createNameplate(name: string, bg: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = PLATE_W
  canvas.height = PLATE_H
  const ctx = canvas.getContext('2d')
  if (ctx) {   // jsdom (unit tests) has no 2d context — the sprite still works, just textureless
    const text = name.length > MAX_NAME_CHARS ? `${name.slice(0, MAX_NAME_CHARS - 1)}…` : name
    ctx.globalAlpha = PLATE_BG_ALPHA
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(0, 0, PLATE_W, PLATE_H, PLATE_RADIUS)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = PLATE_TEXT_COLOR
    ctx.font = PLATE_FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, PLATE_W / 2, PLATE_H / 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(NAMEPLATE_SCALE[0], NAMEPLATE_SCALE[1], 1)
  sprite.position.y = NAMEPLATE_HEIGHT
  sprite.userData.noRaycast = true
  return sprite
}
