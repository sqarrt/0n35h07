import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { unlockPointer } from './helpers'
import { en } from '../src/i18n/locales/en'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// Встать хостом в лобби и раскрыть «// ПРОЧЕЕ» (роль/код/бот).
async function lobbyAsHost(page: Page) {
  await page.getByTestId('menu-play').click()
  await page.getByTestId('lobby-other-toggle').click()
  // Режим по умолчанию 'оба' уже хостит свою комнату (явной роли ХОСТ больше нет).
}

test('главное меню — кнопки навигации видны', async ({ page }) => {
  await expect(page.getByTestId('menu-play')).toBeVisible()
  await expect(page.getByTestId('menu-appearance')).toBeVisible()
  await expect(page.getByTestId('menu-settings')).toBeVisible()
})

test('лобби (хост) — слот соперника пуст, действие = ПОИСК', async ({ page }) => {
  await lobbyAsHost(page)
  await expect(page.getByTestId('lobby-opponent')).toHaveText('—')   // соперника нет
  await expect(page.getByTestId('lobby-search')).toBeVisible()       // не ГОТОВ
  await expect(page.getByTestId('lobby-ready')).toHaveCount(0)
})

test('лобби (хост) — код хоста виден в «ПРОЧЕЕ»', async ({ page }) => {
  await lobbyAsHost(page)
  await expect(page.getByTestId('lobby-code-input')).toHaveValue(/^[A-Z0-9]{4}$/)
})

test('лобби — добавить бота → слот занят, ГОТОВ; убрать → снова пусто и ПОИСК', async ({ page }) => {
  await lobbyAsHost(page)
  await expect(page.getByTestId('lobby-opponent')).toHaveText('—')
  await page.getByTestId('lobby-bot-add').click()
  await expect(page.getByTestId('lobby-opponent')).not.toHaveText('—')   // бот занял слот (ник-«модель»)
  await expect(page.getByTestId('lobby-ready')).toBeVisible()
  await page.getByTestId('lobby-bot-remove').click()
  await expect(page.getByTestId('lobby-opponent')).toHaveText('—')
  await expect(page.getByTestId('lobby-search')).toBeVisible()
})

test('лобби (клиент) — поле ввода кода хоста редактируемо', async ({ page }) => {
  await page.getByTestId('menu-play').click()
  await page.getByTestId('lobby-other-toggle').click()
  await page.getByTestId('lobby-role-client').click()
  await expect(page.getByTestId('lobby-code-input')).toBeVisible()
  await expect(page.getByTestId('lobby-code-input')).toBeEditable()
})

test('лобби → назад → главное меню', async ({ page }) => {
  await page.getByTestId('menu-play').click()
  await page.getByTestId('lobby-back').click()
  await expect(page.getByTestId('menu-play')).toBeVisible()
})

test('копирование кода — клик по кнопке даёт фидбек (✓)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await lobbyAsHost(page)
  await page.getByTestId('lobby-code-copy').click()
  await expect(page.getByTestId('lobby-code-copy')).toHaveText('✓')
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
