import { test, expect } from './fixtures'
import { waitForGame, unlockPointer } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('главное меню — кнопки навигации видны', async ({ page }) => {
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
  await expect(page.getByText('ВОЙТИ В ЛОББИ')).toBeVisible()
})

test('создать лобби — показывает код и настройки', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('КОД ЛОББИ')).toBeVisible()
  await expect(page.getByText('КОЛИЧЕСТВО БОТОВ')).toBeVisible()
  await expect(page.getByText('СЛОЖНОСТЬ')).toBeVisible()
  await expect(page.getByText('НОРМАЛЬНЫЙ')).toBeVisible()
  await expect(page.getByText('ПАССИВНЫЙ')).toBeVisible()
})

test('создать лобби → назад → главное меню', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await page.getByText('НАЗАД').click()
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
  await expect(page.getByText('ВОЙТИ В ЛОББИ')).toBeVisible()
})

test('войти в лобби — показывает ввод кода', async ({ page }) => {
  await page.getByText('ВОЙТИ В ЛОББИ').click()
  await expect(page.getByText('КОД ЛОББИ')).toBeVisible()
  await expect(page.locator('input')).toBeVisible()
})

test('войти в лобби → назад → главное меню', async ({ page }) => {
  await page.getByText('ВОЙТИ В ЛОББИ').click()
  await page.getByText('НАЗАД').click()
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
})

test('войти в лобби → ввести код → показывает лобби', async ({ page }) => {
  await page.getByText('ВОЙТИ В ЛОББИ').click()
  await page.locator('input').fill('AB3K')
  await page.getByRole('button', { name: 'ВОЙТИ' }).click()
  await expect(page.getByText('ЛОББИ')).toBeVisible()
  await expect(page.getByText('КОД: AB3K')).toBeVisible()
})

test('лобби (join) → назад → главное меню', async ({ page }) => {
  await page.getByText('ВОЙТИ В ЛОББИ').click()
  await page.locator('input').fill('TEST')
  await page.getByRole('button', { name: 'ВОЙТИ' }).click()
  await page.getByText('НАЗАД').click()
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
})

test('пауза — Escape показывает меню паузы', async ({ page }) => {
  await unlockPointer(page)
  // Снимаем pointer lock — имитирует нажатие Escape
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  await expect(page.getByText('ПАУЗА')).toBeVisible()
  await expect(page.getByText('ПРОДОЛЖИТЬ')).toBeVisible()
  await expect(page.getByText('В МЕНЮ')).toBeVisible()
})

test('пауза → В меню → главное меню', async ({ page }) => {
  await unlockPointer(page)
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  await page.getByText('В МЕНЮ').click()
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
})
