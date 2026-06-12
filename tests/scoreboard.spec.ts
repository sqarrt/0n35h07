import { test, expect } from './fixtures'
import { unlockPointer, waitForGame } from './helpers'
import { en } from '../src/i18n/locales/en'

test('счёт и имена игроков видны в HUD без Tab', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page)   // navigateThroughMenu + __debugForceLive + pointerLock
  // MatchHud рендерится при locked && phase==='live' — имена игроков видны без нажатия Tab
  await expect(page.locator('.match-hud')).toBeVisible()
  await expect(page.getByTestId('hud-name-opp')).toBeVisible()   // имя соперника-бота (сгенерированное)
  await expect(page.getByTestId('hud-name-opp')).not.toBeEmpty()
})

test('экран конца матча — НИЧЬЯ и ВЫЙТИ при 0:0', async ({ page }) => {
  await page.goto('/')
  await waitForGame(page)   // navigateThroughMenu + __debugForceLive (без pointerLock)
  await page.evaluate(() => (window as any).__debugForceEnd())
  await expect(page.getByTestId('match-outcome')).toHaveText(en.matchOutcomeDraw, { timeout: 5000 })
  await expect(page.getByTestId('match-exit')).toBeVisible({ timeout: 5000 })
})
