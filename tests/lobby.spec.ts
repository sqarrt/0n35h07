import { test, expect } from './fixtures'
import { waitForGame, unlockPointer } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('главное меню — кнопки навигации видны', async ({ page }) => {
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
  await expect(page.getByText('ВОЙТИ В ЛОББИ')).toBeVisible()
})

test('создать лобби — открывает лобби с кодом', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByRole('heading', { name: 'ЛОББИ' })).toBeVisible()
  await expect(page.getByText(/КОД:/)).toBeVisible()
  await expect(page.getByText('ИГРОКОВ: 0')).toBeVisible()
  await expect(page.getByText('ДОБАВИТЬ БОТА')).toBeVisible()
})

test('создать лобби — url меняется на /#CODE', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  const url = page.url()
  expect(url).toMatch(/#[A-Z0-9]{4}$/)
})

test('прямой переход по /#CODE — открывает лобби', async ({ page }) => {
  await page.goto('/#AB3K')
  await expect(page.getByRole('heading', { name: 'ЛОББИ' })).toBeVisible()
  await expect(page.getByText('КОД: AB3K')).toBeVisible()
})

test('прямой переход — несуществующее лобби создаётся с 0 ботами', async ({ page }) => {
  await page.goto('/#XY9Z')
  await expect(page.getByText('ИГРОКОВ: 0')).toBeVisible()
  await expect(page.getByText('ДОБАВИТЬ БОТА')).toBeVisible()
})

test('лобби — добавить бота', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('Бот 1')).not.toBeVisible()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await expect(page.getByText('Бот 1')).toBeVisible()
  await expect(page.getByText('ИГРОКОВ: 1')).toBeVisible()
})

test('лобби — убрать бота', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await expect(page.getByText('Бот 1')).toBeVisible()
  await page.getByRole('button', { name: '×' }).click()
  await expect(page.getByText('Бот 1')).not.toBeVisible()
  await expect(page.getByText('ИГРОКОВ: 0')).toBeVisible()
})

test('лобби — нельзя добавить больше 4 ботов', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  for (let i = 0; i < 4; i++) {
    await page.getByText('ДОБАВИТЬ БОТА').click()
  }
  await expect(page.getByText('Бот 4')).toBeVisible()
  await expect(page.getByText('ДОБАВИТЬ БОТА')).not.toBeVisible()
})

test('лобби заполнено — ВОЙТИ недоступна', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  for (let i = 0; i < 4; i++) {
    await page.getByText('ДОБАВИТЬ БОТА').click()
  }
  await expect(page.getByText('ЛОББИ ЗАПОЛНЕНО')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ВОЙТИ' })).not.toBeVisible()
})

test('лобби → назад → главное меню', async ({ page }) => {
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

test('войти в лобби → ввести код → url меняется', async ({ page }) => {
  await page.getByText('ВОЙТИ В ЛОББИ').click()
  await page.locator('input').fill('AB3K')
  await page.getByRole('button', { name: 'ВОЙТИ' }).click()
  await expect(page.getByRole('heading', { name: 'ЛОББИ' })).toBeVisible()
  await expect(page.getByText('КОД: AB3K')).toBeVisible()
  expect(page.url()).toContain('AB3K')
})

test('пауза — Escape показывает меню паузы', async ({ page }) => {
  await unlockPointer(page)
  await page.evaluate(() => {
    document.exitPointerLock?.()   // освободить реальный лок (авто-PointerLock при входе в игру)
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  await expect(page.getByText('МЕНЮ', { exact: true })).toBeVisible()
  await expect(page.getByText('ПРОДОЛЖИТЬ')).toBeVisible()
  await expect(page.getByText('В МЕНЮ')).toBeVisible()
})

test('пауза → В меню → главное меню', async ({ page }) => {
  await unlockPointer(page)
  await page.evaluate(() => {
    document.exitPointerLock?.()   // освободить реальный лок (авто-PointerLock при входе в игру)
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  await page.getByText('В МЕНЮ').click()
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
})
