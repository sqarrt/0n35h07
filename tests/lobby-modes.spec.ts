import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// Режимы лобби (1v1/2v2/FFA): пикер, сетка сидений, боты кликом, пересадка клиента.
// Боевых ассертов тут нет намеренно — вся боёвка покрыта юнитами (LoopbackNet), e2e боёвка флачит.

async function openBotLobby(page: Page) {
  await page.goto('/')
  await page.getByTestId('menu-play').click()
  await page.getByTestId('lobby-tab-bot').click()   // бот авто-добавлен в слот 1 (режим 1v1)
}

test('ffa: хост добавляет ботов кликами по сиденьям и стартует матч', async ({ page }) => {
  await openBotLobby(page)
  await page.getByTestId('lobby-mode-ffa').click()
  await expect(page.getByTestId('lobby-seats-grid')).toBeVisible()
  await expect(page.getByTestId('lobby-seat-2')).toHaveText('—')
  await page.getByTestId('lobby-seat-2').click()            // бот в слот 2
  await expect(page.getByTestId('lobby-seat-2')).not.toHaveText('—')
  await page.getByTestId('lobby-bot-remove-2').click()      // и убрать его можно
  await expect(page.getByTestId('lobby-seat-2')).toHaveText('—')
  await page.getByTestId('lobby-seat-3').click()            // бот в слот 3 → занятых 3
  await page.getByTestId('lobby-ready').click()             // все занятые ready (боты авто) → старт
  await page.waitForFunction(() => !!(window as any).__debugCamera, undefined, { timeout: 15000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', undefined, { timeout: 5000 })
})

test('2v2: сетка с двумя командными группами, старт при полных составах', async ({ page }) => {
  await openBotLobby(page)
  await page.getByTestId('lobby-mode-2v2').click()
  await expect(page.getByTestId('lobby-seats-grid')).toBeVisible()
  await page.getByTestId('lobby-seat-2').click()            // боты во вражескую пару
  await page.getByTestId('lobby-seat-3').click()
  await expect(page.getByTestId('lobby-seat-3')).not.toHaveText('—')
  await page.getByTestId('lobby-ready').click()
  await page.waitForFunction(() => !!(window as any).__debugCamera, undefined, { timeout: 15000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', undefined, { timeout: 5000 })
})

test('смена режима вниз заблокирована, пока занятых больше лимита', async ({ page }) => {
  await openBotLobby(page)
  await page.getByTestId('lobby-mode-ffa').click()
  await page.getByTestId('lobby-seat-2').click()
  await page.getByTestId('lobby-seat-3').click()            // занятых 4
  await page.getByTestId('lobby-mode-1v1').click()          // no-op
  await expect(page.getByTestId('lobby-seats-grid')).toBeVisible()   // остались в ffa-сетке
  await expect(page.getByTestId('lobby-mode-ffa')).toHaveClass(/seg--on/)
})

test('две вкладки: клиент видит ffa-сетку и пересаживается кликом по свободному слоту', async ({ context }) => {
  const a = await context.newPage()
  const b = await context.newPage()
  const room = 'MODE'
  for (const p of [a, b]) {
    await p.goto('/')
    await p.getByTestId('menu-play').click()
    await p.getByTestId('lobby-tab-friend').click()
    await p.getByTestId('lobby-room-code').fill(room)
  }
  await a.getByTestId('lobby-search').click()
  await b.getByTestId('lobby-search').click()
  await expect(a.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(b.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })

  // Роль решена рукопожатием — хост тот, у кого кликается пикер режима.
  const aIsHost = await a.getByTestId('lobby-mode-ffa').isEnabled()
  const host = aIsHost ? a : b
  const client = aIsHost ? b : a
  await host.getByTestId('lobby-mode-ffa').click()
  await expect(host.getByTestId('lobby-seats-grid')).toBeVisible()
  await expect(client.getByTestId('lobby-seats-grid')).toBeVisible({ timeout: 10000 })

  await expect(client.getByTestId('lobby-seat-1')).toHaveAttribute('data-mine', 'true')
  await client.getByTestId('lobby-seat-3').click()          // пересадка в свободный слот
  await expect(client.getByTestId('lobby-seat-3')).toHaveAttribute('data-mine', 'true', { timeout: 10000 })
  await expect(host.getByTestId('lobby-seat-1')).toHaveText('—')   // у хоста слот 1 освободился
})
