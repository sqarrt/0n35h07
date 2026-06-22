import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { en } from '../src/i18n/locales/en'

// Two pages in ONE context → BroadcastChannel links them (?net=bc by default).
// This way we test real P2P exchange without external trackers.

async function fakeLock(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
}

async function playerZ(page: Page, id: number): Promise<number> {
  return page.evaluate(pid => (window as any).__debugPlayerPos(pid)?.z ?? NaN, id)
}

/** Host raises the lobby, client joins by code, both hit READY → both pages in game (phase 'ready'). */
async function enterGame(context: import('@playwright/test').BrowserContext) {
  const host = await context.newPage()
  const client = await context.newPage()

  // Both: PLAY → "With a friend" tab → same room code → SEARCH (role decided by selfId).
  const room = 'WOLF'
  await host.goto('/')
  await host.getByTestId('menu-play').click()
  await host.getByTestId('lobby-tab-friend').click()
  await host.getByTestId('lobby-room-code').fill(room)

  await client.goto('/')
  await client.getByTestId('menu-play').click()
  await client.getByTestId('lobby-tab-friend').click()
  await client.getByTestId('lobby-room-code').fill(room)

  await host.getByTestId('lobby-search').click()
  await client.getByTestId('lobby-search').click()

  // Both see the opponent in the slot → READY appears for both (human-vs-human: both confirm).
  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(client.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await host.getByTestId('lobby-ready').click()
  await client.getByTestId('lobby-ready').click()

  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  // Role (host/client) is chosen by transport selfId — unknown in advance which page became which.
  // We map variables to actual roles (id 0 = host), otherwise geometry/authority are "swapped".
  return resolveRoles(host, client)
}

/** Map pages by actual roles (`__debugRole`): { host, client }. */
async function resolveRoles(a: Page, b: Page) {
  await expect.poll(() => a.evaluate(() => (window as any).__debugRole?.() ?? null), { timeout: 8000 }).not.toBeNull()
  const roleA = await a.evaluate(() => (window as any).__debugRole())
  return roleA === 'host' ? { host: a, client: b } : { host: b, client: a }
}

/** enterGame + force-live (skipping the countdown) → both pages in phase 'live'. */
async function startMatch(context: import('@playwright/test').BrowserContext) {
  const { host, client } = await enterGame(context)
  await host.evaluate(() => (window as any).__debugForceLive())
  await client.evaluate(() => (window as any).__debugForceLive())
  await expect.poll(() => host.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  await expect.poll(() => client.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  return { host, client }
}

test('1v1: both in BOTH mode find each other and start', async ({ context }) => {
  const host = await context.newPage()
  const client = await context.newPage()
  for (const p of [host, client]) {
    await p.goto('/')
    await p.getByTestId('menu-play').click()
    await p.getByTestId('lobby-search').click()   // default BOTH: advertise(dual)+search
  }
  // The tie-breaker brings them into one connection → READY appears for both.
  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(client.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  // Lobby params resolved by the human in the slot → map/time locked for both (client doesn't edit others' settings).
  await expect(client.locator('.lobby-opts--locked')).toBeVisible()
  await expect(host.locator('.lobby-opts--locked')).toBeVisible()
  await host.getByTestId('lobby-ready').click()
  await client.getByTestId('lobby-ready').click()
  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
})

test('1v1 (With a friend): host can change settings, client cannot', async ({ context }) => {
  const host = await context.newPage()
  const client = await context.newPage()
  const room = 'WOLF'
  for (const p of [host, client]) {
    await p.goto('/')
    await p.getByTestId('menu-play').click()
    await p.getByTestId('lobby-tab-friend').click()
    await p.getByTestId('lobby-room-code').fill(room)
  }
  await host.getByTestId('lobby-search').click()
  await client.getByTestId('lobby-search').click()
  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(client.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  // Role (host/client) is chosen by selfId — unknown in advance which page became which.
  // On the "With a friend" tab EXACTLY the client is locked: one of the two peers has .lobby-opts--locked, the other doesn't.
  const lockedCount = await host.locator('.lobby-opts--locked').count() + await client.locator('.lobby-opts--locked').count()
  expect(lockedCount).toBe(1)
})

test('1v1: host movement is visible on the client', async ({ context }) => {
  const { host, client } = await startMatch(context)
  await expect.poll(() => host.evaluate(() => (window as any).__debugRole())).toBe('host')
  await expect.poll(() => client.evaluate(() => (window as any).__debugRole())).toBe('client')

  await fakeLock(host)
  await host.waitForTimeout(100)
  const z0 = await playerZ(client, 0)   // host position (id 0) as seen by the client
  await host.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })))
  await host.waitForTimeout(1500)
  await host.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))

  await expect.poll(() => playerZ(client, 0), { timeout: 8000 }).toBeLessThan(z0 - 1)
})

test('1v1: client can kill the host (shot reaches the authority)', async ({ context }) => {
  const { host, client } = await startMatch(context)

  // Client aims at the host (id 0, opposite along +Z) and fires.
  await fakeLock(client)
  await client.waitForTimeout(100)
  await client.evaluate(() => {
    const cam = (window as any).__debugCamera
    const hp = (window as any).__debugPlayerPos(0)
    cam.lookAt(hp.x, hp.y, hp.z)
  })
  // Several shots in case of cooldown/frame miss.
  for (let i = 0; i < 3; i++) {
    await client.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })))
    await client.waitForTimeout(700)
  }

  // On the HOST (authority) the host (id 0) death count must increase — the client's shot arrived.
  await expect.poll(() => host.evaluate(() => (window as any).__debugScore(0)?.deaths ?? 0), { timeout: 10000 })
    .toBeGreaterThanOrEqual(1)
})

test('1v1: host orb on the client deflates smoothly after the shot (not in a jerk)', async ({ context }) => {
  const { host, client } = await startMatch(context)

  await fakeLock(host)
  await host.waitForTimeout(150)
  await host.evaluate(() => {
    const cam = (window as any).__debugCamera
    const cp = (window as any).__debugPlayerPos(1)
    cam.lookAt(cp.x, cp.y, cp.z)   // host aims at the client and fires
  })
  // Scale sampler runs INSIDE the client page, on a 25ms timer (3.5s): evaluate round-trips
  // every 40ms missed the 200ms deflation window (WINDUP_SHRINK_MS), and an rAF sampler dies in
  // a backgrounded/overloaded tab. Timers in Playwright are not throttled.
  await client.evaluate(() => {
    const w = window as any
    w.__scaleSamples = []
    const t0 = performance.now()
    const id = setInterval(() => {
      const t = performance.now() - t0
      w.__scaleSamples.push({ t, s: w.__debugBodyScale?.(0) ?? 1 })
      if (t >= 3500) { clearInterval(id); w.__scaleDone = true }
    }, 25)
  })
  await host.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })))

  await client.waitForFunction(() => (window as any).__scaleDone, { timeout: 20000 })
  const samples: { t: number; s: number }[] = await client.evaluate(() => (window as any).__scaleSamples)

  const scales = samples.map(x => x.s)
  const peak = Math.max(...scales)
  expect(peak).toBeGreaterThan(1.2)                                  // orb grew during charge-up
  const peakIdx = scales.indexOf(peak)
  const after = samples.slice(peakIdx + 1)
  expect(Math.min(...after.map(x => x.s))).toBeLessThan(1.05)        // and deflated back

  // Deflation smoothness is observable only if the client's game loop produced frames faster than the 200ms window:
  // the animation is time-based, and with a frame longer than the window intermediate values physically don't exist
  // (legitimate for an overloaded test environment, not a snap). We estimate the frame interval from the orb's
  // GROWTH phase — there the value changes every game frame throughout the whole charge-up (400ms).
  const growth = samples.slice(0, peakIdx + 1).filter(x => x.s > 1.05)
  const distinct = new Set(growth.map(x => x.s)).size
  const growMs = growth.length >= 2 ? growth[growth.length - 1].t - growth[0].t : 0
  const frameMs = distinct >= 2 ? growMs / (distinct - 1) : Infinity
  if (frameMs <= 66) {
    // healthy fps (≥15 frames/s) → the 200ms deflation must contain intermediate frames, otherwise it's a snap
    expect(after.filter(x => x.s > 1.05 && x.s < peak - 0.05).length).toBeGreaterThanOrEqual(1)
  }
})

test('1v1: client disconnected — host sees the banner and (after a pause) EXIT', async ({ context }) => {
  const { host, client } = await startMatch(context)
  await client.evaluate(() => (window as any).__debugLeave())   // client leaves the game
  await expect(host.getByTestId('match-reason')).toHaveText(en.matchReasonDisconnect, { timeout: 6000 })
  await expect(host.getByTestId('match-exit')).toBeVisible({ timeout: 6000 })
  expect(await host.evaluate(() => (window as any).__debugPhase())).toBe('ended')
})

test('1v1: host disconnected — client sees the banner and EXIT', async ({ context }) => {
  const { host, client } = await startMatch(context)
  await host.evaluate(() => (window as any).__debugLeave())
  await expect(client.getByTestId('match-reason')).toHaveText(en.matchReasonDisconnect, { timeout: 6000 })
  await expect(client.getByTestId('match-exit')).toBeVisible({ timeout: 6000 })
})
