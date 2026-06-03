import { test, expect } from './fixtures'
import { unlockPointer, waitForGame } from './helpers'

test('счёт и имена игроков видны в HUD без Tab', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page)   // navigateThroughMenu + __debugForceLive + pointerLock
  // MatchHud рендерится при locked && phase==='live' — имена игроков видны без нажатия Tab
  await expect(page.locator('.match-hud')).toBeVisible()
  await expect(page.locator('.match-hud').getByText('Бот', { exact: true })).toBeVisible()   // имя соперника-бота
})

test('экран конца матча — НИЧЬЯ и ВЫЙТИ при 0:0', async ({ page }) => {
  await page.goto('/')
  await waitForGame(page)   // navigateThroughMenu + __debugForceLive (без pointerLock)
  await page.evaluate(() => (window as any).__debugForceEnd())
  await expect(page.getByText('НИЧЬЯ')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('ВЫЙТИ')).toBeVisible({ timeout: 5000 })
})
