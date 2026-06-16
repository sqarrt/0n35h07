import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { unlockPointer } from './helpers'
import { en } from '../src/i18n/locales/en'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// Встать в лобби (дефолт — вкладка Матчмейкинг, host-сессия поднята).
async function lobby(page: Page) {
  await page.getByTestId('menu-play').click()
}
// Открыть вкладку «С другом».
async function lobbyFriend(page: Page) {
  await lobby(page)
  await page.getByTestId('lobby-tab-friend').click()
}

test('главное меню — кнопки навигации видны', async ({ page }) => {
  await expect(page.getByTestId('menu-play')).toBeVisible()
  await expect(page.getByTestId('menu-appearance')).toBeVisible()
  await expect(page.getByTestId('menu-settings')).toBeVisible()
})

test('лобби — дефолт Матчмейкинг: слот пуст, действие = ПОИСК', async ({ page }) => {
  await lobby(page)
  await expect(page.getByTestId('lobby-tab-matchmaking')).toHaveClass(/lobby-tab--on/)
  await expect(page.getByTestId('lobby-opponent')).toHaveText('—')   // соперника нет
  await expect(page.getByTestId('lobby-search')).toBeVisible()       // не ГОТОВ
  await expect(page.getByTestId('lobby-ready')).toHaveCount(0)
})

test('лобби (С другом) — поле кода комнаты пустое и редактируемо; ПОИСК заблокирован', async ({ page }) => {
  await lobbyFriend(page)
  await expect(page.getByTestId('lobby-room-code')).toHaveValue('')
  await expect(page.getByTestId('lobby-room-code')).toBeEditable()
  await expect(page.getByTestId('lobby-search')).toBeDisabled()   // без кода искать нечего
})

test('лобби (С ботом) — бот в слоте и ГОТОВ; уход с вкладки → снова пусто и ПОИСК', async ({ page }) => {
  await lobby(page)
  await page.getByTestId('lobby-tab-bot').click()
  await expect(page.getByTestId('lobby-opponent')).not.toHaveText('—')   // бот занял слот (ник-«модель»)
  await expect(page.getByTestId('lobby-ready')).toBeEnabled()
  await page.getByTestId('lobby-tab-matchmaking').click()
  await expect(page.getByTestId('lobby-opponent')).toHaveText('—')
  await expect(page.getByTestId('lobby-search')).toBeVisible()
})

test('лобби (С другом) — кнопка рандома заполняет код, ПОИСК разблокируется', async ({ page }) => {
  await lobbyFriend(page)
  await page.getByTestId('lobby-room-random').click()
  await expect(page.getByTestId('lobby-room-code')).toHaveValue(/^[A-Z0-9]{4}$/)
  await expect(page.getByTestId('lobby-search')).toBeEnabled()
})

test('лобби → назад → главное меню', async ({ page }) => {
  await page.getByTestId('menu-play').click()
  await page.getByTestId('lobby-back').click()
  await expect(page.getByTestId('menu-play')).toBeVisible()
})

test('лобби (С другом) — ввод кода вручную разблокирует ПОИСК', async ({ page }) => {
  await lobbyFriend(page)
  await page.getByTestId('lobby-room-code').fill('WOLF')
  await expect(page.getByTestId('lobby-search')).toBeEnabled()
})

test('пауза — Escape показывает меню паузы', async ({ page }) => {
  await unlockPointer(page)
  await page.evaluate(() => {
    document.exitPointerLock?.()   // освободить реальный лок (авто-PointerLock при входе в игру)
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  await expect(page.getByText(en.pauseTitle, { exact: true })).toBeVisible()
  await expect(page.getByTestId('pause-resume')).toBeVisible()
  await expect(page.getByTestId('pause-to-menu')).toBeVisible()
})

test('пауза → В меню → главное меню', async ({ page }) => {
  await unlockPointer(page)
  await page.evaluate(() => {
    document.exitPointerLock?.()
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  await page.getByTestId('pause-to-menu').click()
  await expect(page.getByTestId('menu-play')).toBeVisible()
})
