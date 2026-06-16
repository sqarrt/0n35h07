import { test, expect } from './fixtures'
import type { Page, BrowserContext } from '@playwright/test'

// Две страницы host/client (явные роли, как в killstreak.spec). Камбэк/баунти host-авторитетны.
// Стабильно проверяем: одиночный фраг засчитывается на хосте и у стрелка появляются точки серии.
// Мульти-килл серии (для баунти TRIPLE+) через две фоновые вкладки нестабилен по таймингу →
// формулы баунти/перегрева покрыты юнитами (tests/unit/overheat.test.ts).

async function startMatch(context: BrowserContext) {
  const host = await context.newPage(); const client = await context.newPage()
  await host.goto('/'); await host.getByTestId('menu-play').click()
  await host.getByTestId('lobby-tab-friend').click()   // вкладка «С другом»: свой код виден
  const code = await host.getByTestId('lobby-my-code').inputValue()
  await client.goto('/'); await client.getByTestId('menu-play').click()
  await client.getByTestId('lobby-tab-friend').click()
  await client.getByTestId('lobby-friend-code').fill(code); await client.getByTestId('lobby-join').click()
  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await host.getByTestId('lobby-ready').click(); await client.getByTestId('lobby-ready').click()
  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await host.evaluate(() => (window as any).__debugForceLive()); await client.evaluate(() => (window as any).__debugForceLive())
  await expect.poll(() => host.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  await expect.poll(() => client.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  return { host, client }
}
async function fakeLock(p: Page) {
  await p.evaluate(() => { const c = document.querySelector('canvas')!; Object.defineProperty(document, 'pointerLockElement', { get: () => c, configurable: true }); document.dispatchEvent(new Event('pointerlockchange')) })
}

test('фраг засчитывается (kills>=1) и у стрелка появляются точки серии', async ({ context }) => {
  test.setTimeout(90000)
  const { host, client } = await startMatch(context)
  await fakeLock(client); await client.waitForTimeout(100)
  await client.evaluate(() => { const cam = (window as any).__debugCamera; const hp = (window as any).__debugPlayerPos(0); cam.lookAt(hp.x, hp.y, hp.z) })
  for (let i = 0; i < 4; i++) { await client.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))); await client.waitForTimeout(700) }
  // хост (авторитет) насчитал смерть
  await expect.poll(() => host.evaluate(() => (window as any).__debugScore(0)?.deaths ?? 0), { timeout: 12000 }).toBeGreaterThanOrEqual(1)
  // у стрелка (клиент, id1 = «you» на его странице) появились точки серии
  await client.bringToFront()
  await expect.poll(() => client.evaluate(() => document.querySelector('[data-testid="streak-dots-you"]')?.textContent ?? ''), { timeout: 8000 })
    .toMatch(/●/)
})
