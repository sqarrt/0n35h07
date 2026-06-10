import { test, expect } from './fixtures'
import { unlockPointer } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('главное меню — кнопки навигации видны', async ({ page }) => {
  await expect(page.getByText('СОЗДАТЬ КОМНАТУ')).toBeVisible()
  await expect(page.getByText('ВОЙТИ В КОМНАТУ')).toBeVisible()
  await expect(page.getByText('ВНЕШНОСТЬ')).toBeVisible()
  await expect(page.getByText('НАСТРОЙКИ')).toBeVisible()
})

test('создать комнату — слот соперника пуст, НАЧАТЬ заблокирована', async ({ page }) => {
  await page.getByText('СОЗДАТЬ КОМНАТУ').click()
  await expect(page.getByText('КОМНАТА', { exact: true })).toBeVisible()
  await expect(page.getByText(/КОД:/)).toBeVisible()
  await expect(page.getByText('ОЖИДАНИЕ СОПЕРНИКА…')).toBeVisible()   // слот соперника пуст
  await expect(page.getByText('ДОБАВИТЬ БОТА')).toBeVisible()
  await expect(page.getByRole('button', { name: 'НАЧАТЬ' })).toBeDisabled()   // без соперника старт нельзя
})

test('создать комнату — url меняется на /#CODE', async ({ page }) => {
  await page.getByText('СОЗДАТЬ КОМНАТУ').click()
  const url = page.url()
  expect(url).toMatch(/#[A-Z0-9]{4}$/)
})

test('прямой переход по /#CODE — открывает комнату', async ({ page }) => {
  await page.goto('/#AB3K')
  await expect(page.getByText('КОМНАТА', { exact: true })).toBeVisible()
  await expect(page.getByText('КОД: AB3K')).toBeVisible()
})

test('прямой переход по /#CODE — заходишь клиентом (ждёшь хоста)', async ({ page }) => {
  await page.goto('/#XY9Z')
  await expect(page.getByText('КОМНАТА', { exact: true })).toBeVisible()
  await expect(page.getByText('ПОДКЛЮЧЕНИЕ…')).toBeVisible()       // хоста нет — клиент ждёт
  await expect(page.getByText('ДОБАВИТЬ БОТА')).not.toBeVisible()  // клиент не правит ростер
})

test('комната — добавить бота → слот занят, второго не добавить, старт доступен', async ({ page }) => {
  await page.getByText('СОЗДАТЬ КОМНАТУ').click()
  await expect(page.getByText('Бот', { exact: true })).not.toBeVisible()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await expect(page.getByText('Бот', { exact: true })).toBeVisible()
  await expect(page.getByText('ДОБАВИТЬ БОТА')).not.toBeVisible()   // слот соперника занят
  await expect(page.getByRole('button', { name: 'НАЧАТЬ' })).toBeEnabled()
})

test('комната — убрать бота → слот снова пуст, НАЧАТЬ заблокирована', async ({ page }) => {
  await page.getByText('СОЗДАТЬ КОМНАТУ').click()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await expect(page.getByText('Бот', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '×' }).click()
  await expect(page.getByText('Бот', { exact: true })).not.toBeVisible()
  await expect(page.getByText('ОЖИДАНИЕ СОПЕРНИКА…')).toBeVisible()
  await expect(page.getByRole('button', { name: 'НАЧАТЬ' })).toBeDisabled()
})

test('комната → назад → главное меню', async ({ page }) => {
  await page.getByText('СОЗДАТЬ КОМНАТУ').click()
  await page.getByText('НАЗАД').click()
  await expect(page.getByText('СОЗДАТЬ КОМНАТУ')).toBeVisible()
  await expect(page.getByText('ВОЙТИ В КОМНАТУ')).toBeVisible()
})

test('войти в комнату — показывает ввод кода', async ({ page }) => {
  await page.getByText('ВОЙТИ В КОМНАТУ').click()
  await expect(page.getByText('КОД КОМНАТЫ')).toBeVisible()
  await expect(page.locator('input')).toBeVisible()
})

test('войти в комнату → назад → главное меню', async ({ page }) => {
  await page.getByText('ВОЙТИ В КОМНАТУ').click()
  await page.getByText('НАЗАД').click()
  await expect(page.getByText('СОЗДАТЬ КОМНАТУ')).toBeVisible()
})

test('войти в комнату → ввести код → url меняется', async ({ page }) => {
  await page.getByText('ВОЙТИ В КОМНАТУ').click()
  await page.locator('.code-wrap input').fill('AB3K')
  await page.getByRole('button', { name: 'ВОЙТИ' }).click()
  // После клика экран остаётся на join в состоянии поиска комнаты (хост не отвечает)
  await expect(page.getByText('ПОИСК КОМНАТЫ…')).toBeVisible()
  expect(page.url()).toContain('AB3K')
})

test('вход по несуществующему коду — таймаут показывает ошибку, ВОЙТИ снова активна', async ({ page }) => {
  await page.goto('/')
  await page.getByText('ВОЙТИ В КОМНАТУ').click()
  await page.locator('.code-wrap input').fill('ZZZ9')
  await page.getByRole('button', { name: 'ВОЙТИ' }).click()
  await expect(page.getByText('ПОИСК КОМНАТЫ…')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ВОЙТИ' })).toBeDisabled()
  await expect(page.getByText(/НЕ НАЙДЕНА/)).toBeVisible({ timeout: 13000 })
  await expect(page.getByRole('button', { name: 'ВОЙТИ' })).toBeEnabled()
})

test('копирование кода — клик по коду даёт фидбек', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByText('СОЗДАТЬ КОМНАТУ').click()
  await expect(page.getByText('КОМНАТА', { exact: true })).toBeVisible()
  await page.locator('.room-code-copy').click()
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
  await expect(page.getByText('СОЗДАТЬ КОМНАТУ')).toBeVisible()
})
