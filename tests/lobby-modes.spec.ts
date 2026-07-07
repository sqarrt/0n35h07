import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { revealRoomCode, joinByCode } from './helpers'

// Режимы лобби (Duel/Battle/War): карусель, раскладки сидений, боты зонами, пересадка клиента.
// Боевых ассертов тут нет намеренно — вся боёвка покрыта юнитами (LoopbackNet), e2e боёвка флачит.

async function openLobby(page: Page) {
  await page.goto('/')
  await page.getByTestId('menu-play').click()
}

test('war: хост добавляет ботов зонами и стартует матч', async ({ page }) => {
  await openLobby(page)
  await page.getByTestId('mode-tile-ffa').click()
  await expect(page.getByTestId('lobby-seats')).toHaveAttribute('data-mode', 'ffa')
  await page.getByTestId('seat-addbot-2').click()            // бот в слот 2
  await expect(page.getByTestId('lobby-bot-name-2')).toBeVisible()
  await page.getByTestId('lobby-bot-remove-2').click()       // и убрать его можно
  await expect(page.getByTestId('seat-addbot-2')).toBeVisible()
  await page.getByTestId('seat-addbot-3').click()            // бот в слот 3 → занятых 2, War стартует
  await page.getByTestId('lobby-ready').click()              // все занятые ready (боты авто) → старт
  await page.waitForFunction(() => !!(window as any).__debugCamera, undefined, { timeout: 15000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', undefined, { timeout: 5000 })
})

test('battle: две командные колонки, старт только при полных составах', async ({ page }) => {
  await openLobby(page)
  await page.getByTestId('mode-tile-2v2').click()
  await expect(page.getByTestId('lobby-seats')).toHaveAttribute('data-mode', '2v2')
  await page.getByTestId('seat-addbot-1').click()            // тиммейт-бот
  await page.getByTestId('seat-addbot-2').click()            // бот во вражескую пару
  await expect(page.getByTestId('lobby-ready')).toBeDisabled()   // 3/4 — ещё рано
  await page.getByTestId('seat-addbot-3').click()
  await page.getByTestId('lobby-ready').click()
  await page.waitForFunction(() => !!(window as any).__debugCamera, undefined, { timeout: 15000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', undefined, { timeout: 5000 })
})

test('смена режима вниз заблокирована, пока занятых больше лимита', async ({ page }) => {
  await openLobby(page)
  await page.getByTestId('mode-tile-ffa').click()
  await page.getByTestId('seat-addbot-2').click()
  await page.getByTestId('seat-addbot-3').click()            // занятых 3
  await page.getByTestId('mode-tile-1v1').click()            // no-op (3 не влезают в Duel)
  await expect(page.getByTestId('lobby-seats')).toHaveAttribute('data-mode', 'ffa')
  await expect(page.getByTestId('mode-tile-ffa')).toHaveAttribute('data-role', 'center')
})

test('два окна: гость по коду видит war-раскладку и пересаживается кликом по свободному слоту', async ({ context }) => {
  const host = await context.newPage()
  const guest = await context.newPage()
  await openLobby(host)
  await host.getByTestId('mode-tile-ffa').click()
  const code = await revealRoomCode(host)
  await openLobby(guest)
  await joinByCode(guest, code)

  await expect(guest.getByTestId('lobby-seats')).toHaveAttribute('data-mode', 'ffa', { timeout: 20000 })
  await expect(guest.getByTestId('lobby-seat-1')).toHaveAttribute('data-mine', 'true', { timeout: 20000 })
  await guest.getByTestId('lobby-seat-3').click()            // пересадка в свободный слот
  await expect(guest.getByTestId('lobby-seat-3')).toHaveAttribute('data-mine', 'true', { timeout: 10000 })
  await expect(host.getByTestId('seat-addbot-1')).toBeVisible({ timeout: 10000 })   // слот 1 у хоста снова свободен
})
