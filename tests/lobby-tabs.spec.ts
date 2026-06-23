import { test, expect } from './fixtures'

// e2e runs the web build (no Steam) → tabs are [With a friend, With a bot]; Matchmaking is
// Steam-only and absent here. Default tab is "With a friend".
test.describe('Play sub-tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('menu-play').click()
  })

  test('default — With a friend (web build has no Matchmaking tab)', async ({ page }) => {
    await expect(page.getByTestId('lobby-tab-matchmaking')).toHaveCount(0)
    await expect(page.getByTestId('lobby-tab-friend')).toHaveClass(/lobby-tab--on/)
    await expect(page.getByTestId('lobby-room-code')).toBeEditable()
    await expect(page.getByTestId('lobby-search')).toBeDisabled()   // can't search without a code
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
    await page.getByTestId('lobby-tab-friend').click()
    await expect(page.getByTestId('lobby-opponent')).toHaveText('—')
  })

  test('map/time lock during a friend search', async ({ page }) => {
    await page.getByTestId('lobby-tab-friend').click()
    await page.getByTestId('lobby-room-random').click()
    await page.getByTestId('lobby-search').click()                 // start the code rendezvous
    await expect(page.locator('.lobby-opts--locked')).toBeVisible()
    await page.getByTestId('lobby-stop').click()
    await expect(page.locator('.lobby-opts--locked')).toHaveCount(0)
  })
})
