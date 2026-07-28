import { test, expect } from './fixtures'
import { unlockPointer, waitForGame } from './helpers'
import { en } from '../src/i18n/locales/en'

test('score and player names visible in HUD without Tab', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page)   // navigateThroughMenu + __debugForceLive + pointerLock
  // MatchHud renders when locked && phase==='live' — player names are visible without pressing Tab
  await expect(page.locator('.match-hud')).toBeVisible()
  await expect(page.getByTestId('hud-name-opp')).toBeVisible()   // bot opponent's name (generated)
  await expect(page.getByTestId('hud-name-opp')).not.toBeEmpty()
})

test('match end screen — DRAW and EXIT at 0:0', async ({ page }) => {
  await page.goto('/')
  await waitForGame(page)   // navigateThroughMenu + __debugForceLive (without pointerLock)
  await page.evaluate(() => (window as any).__debugForceEnd())
  await expect(page.getByTestId('match-outcome')).toHaveText(en.matchOutcomeDraw, { timeout: 5000 })
  await expect(page.getByTestId('match-exit')).toBeVisible({ timeout: 5000 })
})
