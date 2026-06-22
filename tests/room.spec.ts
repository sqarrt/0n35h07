import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { unlockPointer } from './helpers'
import { en } from '../src/i18n/locales/en'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// Enter the lobby (default — Matchmaking tab, host session raised).
async function lobby(page: Page) {
  await page.getByTestId('menu-play').click()
}
// Open the "With a friend" tab.
async function lobbyFriend(page: Page) {
  await lobby(page)
  await page.getByTestId('lobby-tab-friend').click()
}

test('main menu — navigation buttons are visible', async ({ page }) => {
  await expect(page.getByTestId('menu-play')).toBeVisible()
  await expect(page.getByTestId('menu-appearance')).toBeVisible()
  await expect(page.getByTestId('menu-settings')).toBeVisible()
})

test('lobby — default Matchmaking: slot empty, action = SEARCH', async ({ page }) => {
  await lobby(page)
  await expect(page.getByTestId('lobby-tab-matchmaking')).toHaveClass(/lobby-tab--on/)
  await expect(page.getByTestId('lobby-opponent')).toHaveText('—')   // no opponent
  await expect(page.getByTestId('lobby-search')).toBeVisible()       // not READY
  await expect(page.getByTestId('lobby-ready')).toHaveCount(0)
})

test('lobby (With a friend) — room code field empty and editable; SEARCH disabled', async ({ page }) => {
  await lobbyFriend(page)
  await expect(page.getByTestId('lobby-room-code')).toHaveValue('')
  await expect(page.getByTestId('lobby-room-code')).toBeEditable()
  await expect(page.getByTestId('lobby-search')).toBeDisabled()   // nothing to search without a code
})

test('lobby (With a bot) — bot in the slot and READY; leaving the tab → empty again and SEARCH', async ({ page }) => {
  await lobby(page)
  await page.getByTestId('lobby-tab-bot').click()
  await expect(page.getByTestId('lobby-opponent')).not.toHaveText('—')   // bot took the slot ("model" nickname)
  await expect(page.getByTestId('lobby-ready')).toBeEnabled()
  await page.getByTestId('lobby-tab-matchmaking').click()
  await expect(page.getByTestId('lobby-opponent')).toHaveText('—')
  await expect(page.getByTestId('lobby-search')).toBeVisible()
})

test('lobby (With a friend) — random button fills the code, SEARCH unlocks', async ({ page }) => {
  await lobbyFriend(page)
  await page.getByTestId('lobby-room-random').click()
  await expect(page.getByTestId('lobby-room-code')).toHaveValue(/^[A-Z0-9]{4}$/)
  await expect(page.getByTestId('lobby-search')).toBeEnabled()
})

test('lobby → back → main menu', async ({ page }) => {
  await page.getByTestId('menu-play').click()
  await page.getByTestId('lobby-back').click()
  await expect(page.getByTestId('menu-play')).toBeVisible()
})

test('lobby (With a friend) — entering the code manually unlocks SEARCH', async ({ page }) => {
  await lobbyFriend(page)
  await page.getByTestId('lobby-room-code').fill('WOLF')
  await expect(page.getByTestId('lobby-search')).toBeEnabled()
})

test('lobby (With a friend) — copying the code gives feedback (✓)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await lobbyFriend(page)
  await page.getByTestId('lobby-room-code').fill('WOLF')
  await page.getByTestId('lobby-code-copy').click()
  await expect(page.getByTestId('lobby-code-copy')).toHaveText('✓')
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
