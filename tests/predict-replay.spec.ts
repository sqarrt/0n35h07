import { test, expect } from './fixtures'
import type { Page, BrowserContext } from '@playwright/test'

// Phase-2 verification under INJECTED latency (?net=bc-lag) — the ~0-RTT BroadcastChannel transport is exactly
// what hid the prediction bugs before. With client-side prediction + replay, the client's OWN player must move
// smoothly forward while holding W: no rubber-band (no large backward jump between frames) despite the lag.

const LAG_URL = '/?net=bc-lag&lagMs=60&jitterMs=15'
const CLIENT_ID = 1   // joiner = OPPONENT_ID (host = HOST_ID 0)

async function fakeLock(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
}

async function startLaggyMatch(context: BrowserContext) {
  const a = await context.newPage()
  const b = await context.newPage()
  const room = 'LAGG'
  for (const p of [a, b]) {
    await p.goto(LAG_URL)
    await p.getByTestId('menu-play').click()
    await p.getByTestId('lobby-tab-friend').click()
    await p.getByTestId('lobby-room-code').fill(room)
  }
  await a.getByTestId('lobby-search').click()
  await b.getByTestId('lobby-search').click()
  await expect(a.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(b.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await a.getByTestId('lobby-ready').click()
  await b.getByTestId('lobby-ready').click()
  await a.waitForFunction(() => !!(window as { __debugCamera?: unknown }).__debugCamera, { timeout: 20000 })
  await b.waitForFunction(() => !!(window as { __debugCamera?: unknown }).__debugCamera, { timeout: 20000 })
  const roleA = await a.evaluate(() => (window as { __debugRole?: () => string }).__debugRole?.())
  const { host, client } = roleA === 'host' ? { host: a, client: b } : { host: b, client: a }
  await host.evaluate(() => (window as { __debugForceLive?: () => void }).__debugForceLive?.())
  await client.evaluate(() => (window as { __debugForceLive?: () => void }).__debugForceLive?.())
  await expect.poll(() => client.evaluate(() => (window as { __debugPhase?: () => string }).__debugPhase?.()), { timeout: 8000 }).toBe('live')
  return { host, client }
}

test('client predicts smoothly under latency — own player advances with no rubber-band', async ({ context }) => {
  const { client } = await startLaggyMatch(context)
  await fakeLock(client)

  // Hold W for ~1.2 s; sample the client's OWN position every ~80 ms IN THE BROWSER (no playwright latency in
  // the sampling). Distance from the start must grow ~monotonically — a rubber-band shows as a backward dip.
  const samples: { x: number; z: number }[] = await client.evaluate(async (id) => {
    const w = window as { __debugPlayerPos?: (i: number) => { x: number; z: number } | null }
    const out: { x: number; z: number }[] = []
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    const t0 = performance.now()
    await new Promise<void>((res) => {
      const tick = () => {
        const p = w.__debugPlayerPos?.(id)
        if (p) out.push({ x: p.x, z: p.z })
        if (performance.now() - t0 > 1200) return res()
        setTimeout(tick, 80)
      }
      tick()
    })
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }))
    return out
  }, CLIENT_ID)

  expect(samples.length).toBeGreaterThan(5)
  const start = samples[0]
  const dist = (s: { x: number; z: number }) => Math.hypot(s.x - start.x, s.z - start.z)
  const dists = samples.map(dist)
  // Actually moved forward:
  expect(dists[dists.length - 1]).toBeGreaterThan(1.5)
  // No rubber-band: distance-from-start never drops more than a small epsilon between consecutive samples.
  const BACK_EPS = 0.3
  for (let i = 1; i < dists.length; i++) {
    expect(dists[i]).toBeGreaterThanOrEqual(dists[i - 1] - BACK_EPS)
  }
})

test('opponent renders smoothly under latency — no jitter in the remote position (interpolation buffer)', async ({ context }) => {
  const { host, client } = await startLaggyMatch(context)
  // Host moves; on the CLIENT, the host (opponent, id 0) must advance with no backward jitter (interpolation buffer).
  await host.evaluate(() => {
    const c = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => c, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
  })
  const samples: { x: number; z: number }[] = await client.evaluate(async () => {
    const w = window as { __debugPlayerPos?: (i: number) => { x: number; z: number } | null }
    const o: { x: number; z: number }[] = []
    const t0 = performance.now()
    await new Promise<void>((res) => {
      const tick = () => { const p = w.__debugPlayerPos?.(0); if (p) o.push({ x: p.x, z: p.z }); if (performance.now() - t0 > 1200) return res(); setTimeout(tick, 80) }
      tick()
    })
    return o
  })
  await host.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))

  expect(samples.length).toBeGreaterThan(5)
  const start = samples[0]
  const dist = (s: { x: number; z: number }) => Math.hypot(s.x - start.x, s.z - start.z)
  const dists = samples.map(dist)
  expect(dists[dists.length - 1]).toBeGreaterThan(1.0)        // the opponent actually moved on our screen
  const BACK_EPS = 0.3
  for (let i = 1; i < dists.length; i++) expect(dists[i]).toBeGreaterThanOrEqual(dists[i - 1] - BACK_EPS)   // no jitter/backward
})
