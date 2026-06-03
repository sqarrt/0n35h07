import { test, expect } from './fixtures'
import { waitForGame, unlockPointer } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('главное меню — кнопки навигации видны', async ({ page }) => {
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
  await expect(page.getByText('ВОЙТИ В ЛОББИ')).toBeVisible()
})

test('создать лобби — слот соперника пуст, НАЧАТЬ заблокирована', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('ЛОББИ', { exact: true })).toBeVisible()
  await expect(page.getByText(/КОД:/)).toBeVisible()
  await expect(page.getByText('ОЖИДАНИЕ СОПЕРНИКА…')).toBeVisible()   // слот соперника пуст
  await expect(page.getByText('ДОБАВИТЬ БОТА')).toBeVisible()
  await expect(page.getByRole('button', { name: 'НАЧАТЬ' })).toBeDisabled()   // без соперника старт нельзя
})

test('создать лобби — url меняется на /#CODE', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  const url = page.url()
  expect(url).toMatch(/#[A-Z0-9]{4}$/)
})

test('прямой переход по /#CODE — открывает лобби', async ({ page }) => {
  await page.goto('/#AB3K')
  await expect(page.getByText('ЛОББИ', { exact: true })).toBeVisible()
  await expect(page.getByText('КОД: AB3K')).toBeVisible()
})

test('прямой переход по /#CODE — заходишь клиентом (ждёшь хоста)', async ({ page }) => {
  await page.goto('/#XY9Z')
  await expect(page.getByText('ЛОББИ', { exact: true })).toBeVisible()
  await expect(page.getByText('ПОДКЛЮЧЕНИЕ…')).toBeVisible()       // хоста нет — клиент ждёт
  await expect(page.getByText('ДОБАВИТЬ БОТА')).not.toBeVisible()  // клиент не правит ростер
})

test('лобби — добавить бота → слот занят, второго не добавить, старт доступен', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('Бот', { exact: true })).not.toBeVisible()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await expect(page.getByText('Бот', { exact: true })).toBeVisible()
  await expect(page.getByText('ДОБАВИТЬ БОТА')).not.toBeVisible()   // слот соперника занят
  await expect(page.getByRole('button', { name: 'НАЧАТЬ' })).toBeEnabled()
})

test('лобби — убрать бота → слот снова пуст, НАЧАТЬ заблокирована', async ({ page }) => {
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await expect(page.getByText('Бот', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '×' }).click()
  await expect(page.getByText('Бот', { exact: true })).not.toBeVisible()
  await expect(page.getByText('ОЖИДАНИЕ СОПЕРНИКА…')).toBeVisible()
  await expect(page.getByRole('button', { name: 'НАЧАТЬ' })).toBeDisabled()
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
  await page.locator('.code-wrap input').fill('AB3K')
  await page.getByRole('button', { name: 'ВОЙТИ' }).click()
  // После клика экран остаётся на join в состоянии подключения (хост не отвечает)
  await expect(page.getByText('ПОДКЛЮЧЕНИЕ…')).toBeVisible()
  expect(page.url()).toContain('AB3K')
})

test('вход по несуществующему коду — таймаут показывает ошибку, ВОЙТИ снова активна', async ({ page }) => {
  await page.goto('/')
  await page.getByText('ВОЙТИ В ЛОББИ').click()
  await page.locator('.code-wrap input').fill('ZZZ9')
  await page.getByRole('button', { name: 'ВОЙТИ' }).click()
  await expect(page.getByText('ПОДКЛЮЧЕНИЕ…')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ВОЙТИ' })).toBeDisabled()
  await expect(page.getByText(/НЕ ОТВЕЧАЕТ/)).toBeVisible({ timeout: 13000 })
  await expect(page.getByRole('button', { name: 'ВОЙТИ' })).toBeEnabled()
})

test('копирование кода — кнопка кликается и даёт фидбек', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('ЛОББИ', { exact: true })).toBeVisible()
  await page.getByText('⧉ КОПИРОВАТЬ').click()
  await expect(page.getByText('СКОПИРОВАНО')).toBeVisible()
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
