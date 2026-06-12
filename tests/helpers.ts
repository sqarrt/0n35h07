import { Page } from '@playwright/test'

export interface NavigateOpts {
  difficulty?: 'normal' | 'passive'
}

// Проходит главное меню если оно открыто (СОЗДАТЬ КОМНАТУ → +бот → НАЧАТЬ).
// 1v1: соперник обязателен, иначе НАЧАТЬ заблокирована — поэтому всегда добавляем бота.
async function navigateThroughMenu(page: Page, opts: NavigateOpts = {}) {
  const menuVisible = await page.getByTestId('menu-create-room').isVisible().catch(() => false)
  if (!menuVisible) return
  await page.getByTestId('menu-create-room').click()
  await page.getByTestId('room-add-bot').click()
  if (opts.difficulty === 'passive') {
    await page.getByTestId('room-difficulty-passive').first().click()
  }
  await page.getByTestId('room-start').click()
}

// Ждём пока R3F инициализируется и смонтирует Game, затем пропускаем ритуал готовности
// (split-ГОТОВ + 3с отсчёт) — gameplay-тестам нужен сразу бой.
export async function waitForGame(page: Page, opts: NavigateOpts = {}) {
  await navigateThroughMenu(page, opts)
  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', { timeout: 5000 })
  // forceLive перепрыгивает ритуал+отсчёт, за время которых в реальном флоу успевает загрузиться
  // Rapier WASM. До привязки мира applyPhysics — no-op (двигаться нельзя) — ждём готовность физики.
  await page.waitForFunction(() => (window as any).__debugPhysicsReady?.() === true, { timeout: 10000 })
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
