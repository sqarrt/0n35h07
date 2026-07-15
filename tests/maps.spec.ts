import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// Enter the Play screen (we host a room right away; the map is chosen under "// MAP").
async function lobbyAsHost(page: Page) {
  await page.getByTestId('menu-play').click()
}

test('lobby — map selection: tile becomes active on click (single selection)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-play').click()
  await expect(page.getByTestId('lobby-map-os_arena')).toBeVisible()

  // By default the first map is active (os_arena).
  await expect(page.getByTestId('lobby-map-os_arena')).toHaveClass(/map-tile--on/)

  // Clicking the os_india tile → it becomes active, os_arena turns off (single-selection mode).
  await page.getByTestId('lobby-map-os_india').click()
  await expect(page.getByTestId('lobby-map-os_india')).toHaveClass(/map-tile--on/)
  await expect(page.getByTestId('lobby-map-os_arena')).not.toHaveClass(/map-tile--on/)
})

test('start on the selected map applies its spawns (os_pillars)', async ({ page }) => {
  await page.goto('/')
  await lobbyAsHost(page)
  await page.getByTestId('lobby-map-os_pillars').click()   // the host owns the map choice
  await page.getByTestId('seat-addbot-1').click()          // bot into the free seat via its zone
  await page.getByTestId('lobby-ready').click()

  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  // Exactly os_pillars spawns were applied (host z ≈ 13, half=15), not another map's.
  const z = await page.evaluate(() => (window as any).__debugPlayerPos(0)?.z ?? NaN)
  expect(z).toBeGreaterThan(11)
  expect(z).toBeLessThan(15)
})

test('os_india: the ramp lets you climb onto the central platform', async ({ page }) => {
  await page.goto('/')
  await lobbyAsHost(page)
  await page.getByTestId('lobby-map-os_india').click()
  await page.getByTestId('seat-addbot-1').click()
  await page.getByTestId('lobby-ready').click()

  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', { timeout: 5000 })
  // "in game" (fake pointer lock) — otherwise input is ignored
  await page.evaluate(() => {
    const c = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => c, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  // Move forward (−Z, up the long climb) in bursts, accumulating the max eye height (we exit as we climbed).
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })))
  let maxY = 0
  for (let i = 0; i < 22 && maxY <= 3; i++) {
    await page.waitForTimeout(450)
    const y = await page.evaluate(() => (window as any).__debugPlayerPos(0)?.y ?? 0)
    if (y > maxY) maxY = y
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))
  // On the ground the eye ≈ 1.7; after climbing onto the platform (top y=3) — noticeably higher.
  expect(maxY).toBeGreaterThan(3)
})
