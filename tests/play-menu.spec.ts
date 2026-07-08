import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { revealRoomCode, joinByCode } from './helpers'

// Экран «Играть» без вкладок: карусель Duel/Battle/War, зоны сидений (инвайт/бот),
// пер-слотовая сложность, веб-джойн по коду, кнопка-автомат READY.

async function openLobby(page: Page) {
  await page.goto('/')
  await page.getByTestId('menu-play').click()
}

test('карусель: War — 4 сиденья, соседние плитки кликабельны, Battle — две командные колонки', async ({ page }) => {
  await openLobby(page)
  await expect(page.getByTestId('mode-tile-1v1')).toHaveAttribute('data-role', 'center')   // Duel по умолчанию
  await page.getByTestId('mode-tile-ffa').click()                    // клик по соседней плитке
  await expect(page.getByTestId('lobby-seats')).toHaveAttribute('data-mode', 'ffa')
  await expect(page.getByTestId('lobby-seat-3')).toBeVisible()       // колонка из 4
  await page.getByTestId('mode-tile-1v1').click()                    // ffa → 1v1
  await expect(page.getByTestId('lobby-seats')).toHaveAttribute('data-mode', '1v1')
  await page.getByTestId('mode-tile-2v2').click()                    // 1v1 → 2v2
  await expect(page.getByTestId('lobby-seats')).toHaveAttribute('data-mode', '2v2')
  expect(await page.locator('.seats-col').count()).toBe(2)
})

test('зоны сиденья: бот с пер-слотовой сложностью, ✕ освобождает, READY-автомат', async ({ page }) => {
  await openLobby(page)
  await expect(page.getByTestId('lobby-ready')).toBeDisabled()       // состав неполный
  await page.getByTestId('seat-addbot-1').click()
  await expect(page.getByTestId('lobby-bot-name-1')).toBeVisible()
  await expect(page.getByTestId('seat-diff-1-normal')).toHaveClass(/seg--on/)
  await page.getByTestId('seat-diff-1-passive').click()
  await expect(page.getByTestId('seat-diff-1-passive')).toHaveClass(/seg--on/)
  await expect(page.getByTestId('lobby-ready')).toBeEnabled()        // пара полная (хост+бот)
  await page.getByTestId('lobby-bot-remove-1').click()
  await expect(page.getByTestId('seat-addbot-1')).toBeVisible()      // зоны вернулись
  await expect(page.getByTestId('lobby-ready')).toBeDisabled()
})

test('инвайт-зона раскрывает код комнаты; клик по коду копирует (✓)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openLobby(page)
  const code = await revealRoomCode(page)
  expect(code).toMatch(/^[A-Z0-9]{4}$/)
  await page.getByTestId('seat-code-1').click()
  await expect(page.getByTestId('seat-code-1')).toContainText('✓')
})

test('поле «по коду»: кнопка активна только с введённым кодом', async ({ page }) => {
  await openLobby(page)
  await expect(page.getByTestId('join-code-go')).toBeDisabled()
  await page.getByTestId('join-code-field').fill('WOLF')
  await expect(page.getByTestId('join-code-go')).toBeEnabled()
})

test('battle: гость по коду сел (у хоста имя появилось), докомплект ботами, хост ready → ждёт остальных', async ({ context }) => {
  const host = await context.newPage()
  const guest = await context.newPage()
  await openLobby(host)
  await host.getByTestId('mode-tile-2v2').click()
  const code = await revealRoomCode(host)
  await openLobby(guest)
  await joinByCode(guest, code)
  await expect(guest.getByTestId('lobby-seat-1')).toHaveAttribute('data-mine', 'true', { timeout: 20000 })
  await expect(host.getByTestId('lobby-seat-1').locator('.lobby-nick')).toBeVisible({ timeout: 20000 })
  await expect(host.getByTestId('lobby-ready')).toBeDisabled()       // 2/4 — Battle стартует только полным
  await host.getByTestId('seat-addbot-2').click()
  await host.getByTestId('seat-addbot-3').click()
  await expect(host.getByTestId('lobby-ready')).toBeEnabled({ timeout: 10000 })
  await host.getByTestId('lobby-ready').click()                      // хост ready, гость ещё нет
  await expect(host.getByTestId('lobby-waiting')).toBeDisabled()     // «ждём остальных»
})
