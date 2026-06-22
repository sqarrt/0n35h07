import { test, expect } from './fixtures'

test.describe('Play sub-tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('menu-play').click()
  })

  test('default — Matchmaking (SEARCH visible)', async ({ page }) => {
    await expect(page.getByTestId('lobby-tab-matchmaking')).toHaveClass(/lobby-tab--on/)
    await expect(page.getByTestId('lobby-search')).toBeVisible()
  })

  test('With a friend: room code field + random fill, SEARCH by code', async ({ page }) => {
    await page.getByTestId('lobby-tab-friend').click()
    await expect(page.getByTestId('lobby-room-code')).toBeEditable()
    await expect(page.getByTestId('lobby-search')).toBeDisabled()   // can't search without a code
    await page.getByTestId('lobby-room-random').click()
    await expect(page.getByTestId('lobby-room-code')).toHaveValue(/^[A-Z0-9]{4}$/)
    await expect(page.getByTestId('lobby-search')).toBeEnabled()
  })

  test('With a bot: auto-bot in slot, READY enabled, difficulty switch', async ({ page }) => {
    await page.getByTestId('lobby-tab-bot').click()
    await expect(page.getByTestId('lobby-opponent')).not.toHaveText('—')
    await expect(page.getByTestId('lobby-ready')).toBeEnabled()
    await page.getByTestId('lobby-bot-diff-passive').click()
    await expect(page.getByTestId('lobby-bot-diff-passive')).toHaveClass(/seg--on/)
  })

  test('leaving the bot tab removes the bot', async ({ page }) => {
    await page.getByTestId('lobby-tab-bot').click()
    await expect(page.getByTestId('lobby-opponent')).not.toHaveText('—')
    await page.getByTestId('lobby-tab-matchmaking').click()
    await expect(page.getByTestId('lobby-opponent')).toHaveText('—')
  })

  test('map/time on Matchmaking are locked during search', async ({ page }) => {
    await page.getByTestId('lobby-search').click()                 // start search
    await expect(page.locator('.lobby-opts--locked')).toBeVisible()
    await page.getByTestId('lobby-stop').click()
    await expect(page.locator('.lobby-opts--locked')).toHaveCount(0)
  })
})
