import { Page } from '@playwright/test'

// Ждём пока R3F инициализируется и смонтирует Game
export async function waitForGame(page: Page) {
  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
}

export async function unlockPointer(page: Page) {
  await waitForGame(page)
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
}

export async function getCameraPos(page: Page) {
  return page.evaluate(() => {
    const cam = (window as any).__debugCamera
    return { x: +cam.position.x.toFixed(3), y: +cam.position.y.toFixed(3), z: +cam.position.z.toFixed(3) }
  })
}

export async function holdKey(page: Page, code: string, ms: number) {
  await page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code)
  await page.waitForTimeout(ms)
  await page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), code)
}

export async function mouseDown(page: Page, button: number) {
  await page.evaluate((b) => window.dispatchEvent(new MouseEvent('mousedown', { button: b, bubbles: true })), button)
}
