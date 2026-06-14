import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// Встать хостом в лобби (роль/бот — в «// ПРОЧЕЕ»; карта выбирается в «// КАРТА»).
async function lobbyAsHost(page: Page) {
  await page.getByTestId('menu-play').click()
  await page.getByTestId('lobby-other-toggle').click()
  // режим 'оба' по умолчанию уже хостит комнату (явной роли ХОСТ больше нет)
}

test('лобби — выбор карты: плитка активна при клике (одиночный выбор)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-play').click()
  await expect(page.getByTestId('lobby-map-os_arena')).toBeVisible()

  // По умолчанию активна первая карта (os_arena).
  await expect(page.getByTestId('lobby-map-os_arena')).toHaveClass(/map-tile--on/)

  // Клик по плитке os_india → активной становится она, os_arena гаснет (режим одиночного выбора).
  await page.getByTestId('lobby-map-os_india').click()
  await expect(page.getByTestId('lobby-map-os_india')).toHaveClass(/map-tile--on/)
  await expect(page.getByTestId('lobby-map-os_arena')).not.toHaveClass(/map-tile--on/)
})

test('старт на выбранной карте применяет её спавны (os_pillars)', async ({ page }) => {
  await page.goto('/')
  await lobbyAsHost(page)
  await page.getByTestId('lobby-map-os_pillars').click()   // до добавления бота «// КАРТА» ещё не залочена
  await page.getByTestId('lobby-bot-add').click()
  await page.getByTestId('lobby-ready').click()

  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  // Применились спавны именно os_pillars (хост z ≈ 13, half=15), а не другой карты.
  const z = await page.evaluate(() => (window as any).__debugPlayerPos(0)?.z ?? NaN)
  expect(z).toBeGreaterThan(11)
  expect(z).toBeLessThan(15)
})

test('os_india: по рампе можно подняться на центральную площадку', async ({ page }) => {
  await page.goto('/')
  await lobbyAsHost(page)
  await page.getByTestId('lobby-map-os_india').click()
  await page.getByTestId('lobby-bot-add').click()
  await page.getByTestId('lobby-ready').click()

  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', { timeout: 5000 })
  // «в игре» (фейк pointer lock) — иначе ввод игнорируется
  await page.evaluate(() => {
    const c = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => c, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  // Идём вперёд (−Z, на длинный подъём) бёрстами, копим максимум высоты глаз (выходим, как поднялись).
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })))
  let maxY = 0
  for (let i = 0; i < 22 && maxY <= 3; i++) {
    await page.waitForTimeout(450)
    const y = await page.evaluate(() => (window as any).__debugPlayerPos(0)?.y ?? 0)
    if (y > maxY) maxY = y
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))
  // На земле глаз ≈ 1.7; поднявшись на площадку (верх y=3) — заметно выше.
  expect(maxY).toBeGreaterThan(3)
})
