import { test, expect } from './fixtures'

test.describe('Подвкладки Играть', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('menu-play').click()
  })

  test('дефолт — Матчмейкинг (ПОИСК виден)', async ({ page }) => {
    await expect(page.getByTestId('lobby-tab-matchmaking')).toHaveClass(/lobby-tab--on/)
    await expect(page.getByTestId('lobby-search')).toBeVisible()
  })

  test('С другом: свой код + поле кода друга', async ({ page }) => {
    await page.getByTestId('lobby-tab-friend').click()
    await expect(page.getByTestId('lobby-my-code')).toHaveValue(/^[A-Z0-9]{4}$/)
    await expect(page.getByTestId('lobby-friend-code')).toBeEditable()
  })

  test('С ботом: авто-бот в слоте, ГОТОВ активен, смена сложности', async ({ page }) => {
    await page.getByTestId('lobby-tab-bot').click()
    await expect(page.getByTestId('lobby-opponent')).not.toHaveText('—')
    await expect(page.getByTestId('lobby-ready')).toBeEnabled()
    await page.getByTestId('lobby-bot-diff-passive').click()
    await expect(page.getByTestId('lobby-bot-diff-passive')).toHaveClass(/seg--on/)
  })

  test('уход с вкладки бота убирает бота', async ({ page }) => {
    await page.getByTestId('lobby-tab-bot').click()
    await expect(page.getByTestId('lobby-opponent')).not.toHaveText('—')
    await page.getByTestId('lobby-tab-matchmaking').click()
    await expect(page.getByTestId('lobby-opponent')).toHaveText('—')
  })

  test('карта/время на Матчмейкинге залочены во время поиска', async ({ page }) => {
    await page.getByTestId('lobby-search').click()                 // старт поиска
    await expect(page.locator('.lobby-opts--locked')).toBeVisible()
    await page.getByTestId('lobby-stop').click()
    await expect(page.locator('.lobby-opts--locked')).toHaveCount(0)
  })
})
