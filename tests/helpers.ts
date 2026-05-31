import { Page } from '@playwright/test'

export interface NavigateOpts {
  difficulty?: 'normal' | 'passive'
}

// Проходит главное меню если оно открыто (СОЗДАТЬ ЛОББИ → лобби → НАЧАТЬ ИГРУ)
async function navigateThroughMenu(page: Page, opts: NavigateOpts = {}) {
  const menuVisible = await page.getByText('СОЗДАТЬ ЛОББИ').isVisible().catch(() => false)
  if (!menuVisible) return
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  // Хост-лобби: добавляем бота если тест требует цель
  if (opts.difficulty) {
    await page.getByText('ДОБАВИТЬ БОТА').click()
    if (opts.difficulty === 'passive') {
      await page.getByText('ПАССИВНЫЙ').first().click()
    }
  }
  await page.getByText('НАЧАТЬ').click()
}

// Ждём пока R3F инициализируется и смонтирует Game
export async function waitForGame(page: Page, opts: NavigateOpts = {}) {
  await navigateThroughMenu(page, opts)
  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
}

export async function unlockPointer(page: Page, opts: NavigateOpts = {}) {
  await waitForGame(page, opts)
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

export async function aimAtBot(page: Page, botId = 0) {
  await page.evaluate((id) => {
    const cam = (window as any).__debugCamera
    const getPos = (window as any).__debugBotPos?.[id]
    if (!cam || !getPos) return
    const pos = getPos()
    if (pos) cam.lookAt(pos.x, pos.y + 0.5, pos.z)
  }, botId)
}
