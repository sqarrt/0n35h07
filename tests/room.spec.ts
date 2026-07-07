import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { unlockPointer } from './helpers'
import { en } from '../src/i18n/locales/en'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// Enter the Play screen (no tabs: Duel preset, we host an open room right away).
async function lobby(page: Page) {
  await page.getByTestId('menu-play').click()
}

test('main menu — navigation buttons are visible', async ({ page }) => {
  await expect(page.getByTestId('menu-play')).toBeVisible()
  await expect(page.getByTestId('menu-appearance')).toBeVisible()
  await expect(page.getByTestId('menu-settings')).toBeVisible()
})

test('Play screen (web) — Duel centered, both seat zones, no SEARCH, READY disabled', async ({ page }) => {
  await lobby(page)
  await expect(page.getByTestId('mode-tile-1v1')).toHaveAttribute('data-role', 'center')
  await expect(page.getByTestId('seat-invite-1')).toBeVisible()      // invite zone
  await expect(page.getByTestId('seat-addbot-1')).toBeVisible()      // add-a-bot zone
  await expect(page.getByTestId('join-code-field')).toBeVisible()    // web guest path
  await expect(page.getByTestId('lobby-search')).toHaveCount(0)      // search is Steam-only
  await expect(page.getByTestId('lobby-ready')).toBeDisabled()       // seats not full yet
})

test('lobby → back → main menu', async ({ page }) => {
  await page.getByTestId('menu-play').click()
  await page.getByTestId('lobby-back').click()
  await expect(page.getByTestId('menu-play')).toBeVisible()
})

test('pause — Escape shows the pause menu', async ({ page }) => {
  await unlockPointer(page)
  await page.evaluate(() => {
    document.exitPointerLock?.()   // release the real lock (auto-PointerLock on entering the game)
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  await expect(page.getByText(en.pauseTitle, { exact: true })).toBeVisible()
  await expect(page.getByTestId('pause-resume')).toBeVisible()
  await expect(page.getByTestId('pause-to-menu')).toBeVisible()
})

test('pause → To menu → main menu', async ({ page }) => {
  await unlockPointer(page)
  await page.evaluate(() => {
    document.exitPointerLock?.()
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  await page.getByTestId('pause-to-menu').click()
  await expect(page.getByTestId('menu-play')).toBeVisible()
})
