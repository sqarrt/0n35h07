import { test, expect } from './fixtures'
import { unlockPointer, waitForGame } from './helpers'

test('счёт ВЫ/СОПЕРНИК виден в HUD без Tab', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page)   // navigateThroughMenu + __debugForceLive + pointerLock
  // MatchHud рендерится при locked && phase==='live' — проверяем метки без нажатия Tab
  await expect(page.locator('.match-hud').getByText('ВЫ', { exact: true })).toBeVisible()
  await expect(page.locator('.match-hud').getByText('СОПЕРНИК', { exact: true })).toBeVisible()
})

test('экран конца матча — НИЧЬЯ и ВЫЙТИ при 0:0', async ({ page }) => {
  await page.goto('/')
  await waitForGame(page)   // navigateThroughMenu + __debugForceLive (без pointerLock)
  await page.evaluate(() => (window as any).__debugForceEnd())
  await expect(page.getByText('НИЧЬЯ')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('ВЫЙТИ')).toBeVisible({ timeout: 5000 })
})
