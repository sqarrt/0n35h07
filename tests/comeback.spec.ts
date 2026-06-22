import { test, expect } from './fixtures'
import type { Page, BrowserContext } from '@playwright/test'

// Two host/client pages (explicit roles, as in killstreak.spec). Comeback/bounty are host-authoritative.
// Stable check: a single frag is counted on the host and the shooter gains streak dots.
// Multi-kill streaks (for TRIPLE+ bounty) via two background tabs are timing-unstable →
// bounty/overheat formulas are covered by unit tests (tests/unit/overheat.test.ts).

async function startMatch(context: BrowserContext) {
  const host = await context.newPage(); const client = await context.newPage()
  const room = 'WOLF'
  await host.goto('/'); await host.getByTestId('menu-play').click()
  await host.getByTestId('lobby-tab-friend').click(); await host.getByTestId('lobby-room-code').fill(room)
  await client.goto('/'); await client.getByTestId('menu-play').click()
  await client.getByTestId('lobby-tab-friend').click(); await client.getByTestId('lobby-room-code').fill(room)
  await host.getByTestId('lobby-search').click(); await client.getByTestId('lobby-search').click()
  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await host.getByTestId('lobby-ready').click(); await client.getByTestId('lobby-ready').click()
  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await host.evaluate(() => (window as any).__debugForceLive()); await client.evaluate(() => (window as any).__debugForceLive())
  await expect.poll(() => host.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  await expect.poll(() => client.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  // Role is decided by selfId → map variables to actual roles (host = id 0, authoritative).
  const roleA = await host.evaluate(() => (window as any).__debugRole())
  return roleA === 'host' ? { host, client } : { host: client, client: host }
}
async function fakeLock(p: Page) {
  await p.evaluate(() => { const c = document.querySelector('canvas')!; Object.defineProperty(document, 'pointerLockElement', { get: () => c, configurable: true }); document.dispatchEvent(new Event('pointerlockchange')) })
}

test('frag is counted (kills>=1) and the shooter gains streak dots', async ({ context }) => {
  test.setTimeout(90000)
  const { host, client } = await startMatch(context)
  await fakeLock(client); await client.waitForTimeout(100)
  await client.evaluate(() => { const cam = (window as any).__debugCamera; const hp = (window as any).__debugPlayerPos(0); cam.lookAt(hp.x, hp.y, hp.z) })
  for (let i = 0; i < 4; i++) { await client.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))); await client.waitForTimeout(700) }
  // host (authority) counted a death
  await expect.poll(() => host.evaluate(() => (window as any).__debugScore(0)?.deaths ?? 0), { timeout: 12000 }).toBeGreaterThanOrEqual(1)
  // the shooter (client, id1 = "you" on its page) gained streak dots
  await client.bringToFront()
  await expect.poll(() => client.evaluate(() => document.querySelector('[data-testid="streak-dots-you"]')?.textContent ?? ''), { timeout: 8000 })
    .toMatch(/●/)
})
