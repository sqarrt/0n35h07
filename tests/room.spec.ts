import { test, expect } from './fixtures'
import { unlockPointer } from './helpers'
import { en } from '../src/i18n/locales/en'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('главное меню — кнопки навигации видны', async ({ page }) => {
  await expect(page.getByTestId('menu-create-room')).toBeVisible()
  await expect(page.getByTestId('menu-join-room')).toBeVisible()
  await expect(page.getByTestId('menu-appearance')).toBeVisible()
  await expect(page.getByTestId('menu-settings')).toBeVisible()
})

test('создать комнату — слот соперника пуст, НАЧАТЬ заблокирована', async ({ page }) => {
  await page.getByTestId('menu-create-room').click()
  await expect(page.getByTestId('room-title')).toBeVisible()
  await expect(page.getByTestId('room-code')).toBeVisible()
  await expect(page.getByText(en.roomWaitingOpponent)).toBeVisible()   // слот соперника пуст
  await expect(page.getByTestId('room-add-bot')).toBeVisible()
  await expect(page.getByTestId('room-start')).toBeDisabled()   // без соперника старт нельзя
})

test('создать комнату — url меняется на /#CODE', async ({ page }) => {
  await page.getByTestId('menu-create-room').click()
  const url = page.url()
  expect(url).toMatch(/#[A-Z0-9]{4}$/)
})

test('прямой переход по /#CODE — открывает комнату', async ({ page }) => {
  await page.goto('/#AB3K')
  await expect(page.getByTestId('room-title')).toBeVisible()
  await expect(page.getByTestId('room-code')).toHaveText('AB3K')
})

test('прямой переход по /#CODE — заходишь клиентом (ждёшь хоста)', async ({ page }) => {
  await page.goto('/#XY9Z')
  await expect(page.getByTestId('room-title')).toBeVisible()
  await expect(page.getByText(en.roomConnecting)).toBeVisible()       // хоста нет — клиент ждёт
  await expect(page.getByTestId('room-add-bot')).not.toBeVisible()   // клиент не правит ростер
})

test('комната — добавить бота → слот занят, второго не добавить, старт доступен', async ({ page }) => {
  await page.getByTestId('menu-create-room').click()
  await expect(page.getByText('Бот', { exact: true })).not.toBeVisible()
  await page.getByTestId('room-add-bot').click()
  await expect(page.getByText('Бот', { exact: true })).toBeVisible()
  await expect(page.getByTestId('room-add-bot')).not.toBeVisible()   // слот соперника занят
  await expect(page.getByTestId('room-start')).toBeEnabled()
})

test('комната — убрать бота → слот снова пуст, НАЧАТЬ заблокирована', async ({ page }) => {
  await page.getByTestId('menu-create-room').click()
  await page.getByTestId('room-add-bot').click()
  await expect(page.getByText('Бот', { exact: true })).toBeVisible()
  await page.getByTestId('room-remove-bot').click()
  await expect(page.getByText('Бот', { exact: true })).not.toBeVisible()
  await expect(page.getByText(en.roomWaitingOpponent)).toBeVisible()
  await expect(page.getByTestId('room-start')).toBeDisabled()
})

test('комната → назад → главное меню', async ({ page }) => {
  await page.getByTestId('menu-create-room').click()
  await page.getByTestId('room-back').click()
  await expect(page.getByTestId('menu-create-room')).toBeVisible()
  await expect(page.getByTestId('menu-join-room')).toBeVisible()
})

test('войти в комнату — показывает ввод кода', async ({ page }) => {
  await page.getByTestId('menu-join-room').click()
  await expect(page.getByTestId('join-title')).toBeVisible()
  await expect(page.getByTestId('join-code-input')).toBeVisible()
})

test('войти в комнату → назад → главное меню', async ({ page }) => {
  await page.getByTestId('menu-join-room').click()
  await page.getByTestId('join-back').click()
  await expect(page.getByTestId('menu-create-room')).toBeVisible()
})

test('войти в комнату → ввести код → url меняется', async ({ page }) => {
  await page.getByTestId('menu-join-room').click()
  await page.getByTestId('join-code-input').fill('AB3K')
  await page.getByTestId('join-submit').click()
  // После клика экран остаётся на join в состоянии поиска комнаты (хост не отвечает)
  await expect(page.getByTestId('join-status')).toHaveText(en.joinStatusSearching)
  expect(page.url()).toContain('AB3K')
})

test('вход по несуществующему коду — таймаут показывает ошибку, ВОЙТИ снова активна', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-join-room').click()
  await page.getByTestId('join-code-input').fill('ZZZ9')
  await page.getByTestId('join-submit').click()
  await expect(page.getByTestId('join-status')).toHaveText(en.joinStatusSearching)
  await expect(page.getByTestId('join-submit')).toBeDisabled()
  await expect(page.getByTestId('join-status')).toHaveText(en.joinStatusNotFound('ZZZ9'), { timeout: 13000 })
  await expect(page.getByTestId('join-submit')).toBeEnabled()
})

test('копирование кода — клик по коду даёт фидбек', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByTestId('menu-create-room').click()
  await expect(page.getByTestId('room-title')).toBeVisible()
  await page.locator('.room-code-copy').click()
  await expect(page.getByText(en.roomCopied)).toBeVisible()
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
  await expect(page.getByTestId('menu-create-room')).toBeVisible()
})
