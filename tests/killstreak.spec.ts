import { test, expect } from './fixtures'
import type { Page, BrowserContext } from '@playwright/test'
import { revealRoomCode, joinByCode } from './helpers'

// Two host/client pages via BroadcastChannel (?net=bc). Combat is computed by the host, the kill event (with streak/
// firstBlood) goes to both sides → both announce. We check a stable scenario: the match's first frag = CATALYST.
//
// Note: multi-kill streaks (DOUBLE/TRIPLE/…) and highlight reset on death are NOT covered by e2e — kills
// through two background-throttled Chromium tabs are timing-unstable (especially several in a row).
// The numeric streak logic (streakTier/announceKind/words/sounds) is fully covered by unit tests (tests/unit/streak.test.ts).

// The page that opened Play first hosts its own room (id 0); the second joins by its code.
async function startMatch(context: BrowserContext) {
  const host = await context.newPage()
  const client = await context.newPage()

  await host.goto('/')
  await host.getByTestId('menu-play').click()
  const code = await revealRoomCode(host)
  await client.goto('/')
  await client.getByTestId('menu-play').click()
  await joinByCode(client, code)

  // Run the symmetric waits IN PARALLEL: under CPU contention (workers:4, 2 pages with
  // Rapier WASM) sequential waits (20s+20s+…) add up by wall-clock and blow the test budget.
  await Promise.all([
    expect(host.getByTestId('lobby-ready')).toBeEnabled({ timeout: 20000 }),
    expect(client.getByTestId('lobby-ready')).toBeEnabled({ timeout: 20000 }),
  ])
  await Promise.all([
    host.getByTestId('lobby-ready').click(),
    client.getByTestId('lobby-ready').click(),
  ])
  await Promise.all([
    host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 }),
    client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 }),
  ])
  await Promise.all([
    host.evaluate(() => (window as any).__debugForceLive()),
    client.evaluate(() => (window as any).__debugForceLive()),
  ])
  await Promise.all([
    expect.poll(() => host.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live'),
    expect.poll(() => client.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live'),
  ])
  return { host, client }   // roles are deterministic: the creator page is the host (id 0)
}

async function fakeLock(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
}

test('match first frag → CATALYST (host authority)', async ({ context }) => {
  test.setTimeout(120000)
  const { host, client } = await startMatch(context)

  // The client aims at the host (id 0) and fires (several times — for cooldown/frame miss, as in multiplayer.spec).
  await fakeLock(client)
  await client.waitForTimeout(100)
  await client.evaluate(() => { const cam = (window as any).__debugCamera; const hp = (window as any).__debugPlayerPos(0); cam.lookAt(hp.x, hp.y, hp.z) })
  for (let i = 0; i < 4; i++) {
    await client.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })))
    await client.waitForTimeout(700)
  }

  // The host (authority) counted a death → match's first frag, and in resolveCombat announced the streak synchronously.
  // We check on the host (it counts locally, without network delay). There are several shots → there may be
  // several kills (catalyst → double → …), so we check the FIRST announce in history — it's always CATALYST.
  await expect.poll(() => host.evaluate(() => (window as any).__debugScore(0)?.deaths ?? 0), { timeout: 12000 }).toBeGreaterThanOrEqual(1)
  await expect.poll(() => host.evaluate(() => (window as any).__debugAnnounces?.[0]), { timeout: 8000 }).toBe('catalyst')
})
