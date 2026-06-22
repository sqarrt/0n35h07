import { test, expect } from './fixtures'
import { unlockPointer, getCameraPos, holdKey } from './helpers'

const MOVE_MS = 400

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })   // inert bot: doesn't interfere with deltas in a shared session
})

test('WASD — four directions and fixed height (single session)', async ({ page }) => {
  // The camera looks along −Z by default. Each segment is short (≈2.8 units) — the walls are far.
  const fwd0 = await getCameraPos(page)
  await holdKey(page, 'KeyW', MOVE_MS)
  const fwd1 = await getCameraPos(page)
  expect(fwd1.z).toBeLessThan(fwd0.z)              // W — forward (Z decreases)

  await holdKey(page, 'KeyS', MOVE_MS)
  const back = await getCameraPos(page)
  expect(back.z).toBeGreaterThan(fwd1.z)           // S — backward (Z increases)

  const strafe0 = await getCameraPos(page)
  await holdKey(page, 'KeyA', MOVE_MS)
  const left = await getCameraPos(page)
  expect(left.x).toBeLessThan(strafe0.x)           // A — strafe left (X decreases)

  await holdKey(page, 'KeyD', MOVE_MS)
  const right = await getCameraPos(page)
  expect(right.x).toBeGreaterThan(left.x)          // D — strafe right (X increases)

  expect(right.y).toBeCloseTo(1.7, 1)              // eye height is fixed while walking
})

test('Space — jump and landing', async ({ page }) => {
  // Press Space (keydown) until the camera rises (Rapier physics may still be loading under load).
  await page.waitForFunction(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    const cam = (window as any).__debugCamera
    return !!cam && cam.position.y > 1.75
  }, { timeout: 6000, polling: 100 })
  expect((await getCameraPos(page)).y).toBeGreaterThan(1.7)   // lifted off

  // RELEASE Space — otherwise holding = auto-bhop and the player won't land.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })))
  // Wait for landing BY CONDITION, not a fixed timeout: under load the fall can take longer than 1200ms (flaky).
  await expect.poll(async () => (await getCameraPos(page)).y, { timeout: 6000 }).toBeCloseTo(1.7, 1)   // back on the ground
})

test('bhop — holding Space gives a series of jumps even with W+D (without OS auto-repeat)', async ({ page }) => {
  // Regression: previously bhop relied on OS auto-repeat of Space, and W+D+Space broke it. Now the jump is held-input:
  // a single Space press (no keyup) + W + D → keys.jump stays true → auto-jump on every landing.
  await page.evaluate(() => {
    for (const code of ['Space', 'KeyW', 'KeyD']) window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
  })
  let bounces = 0
  let wasAir = false
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(40)
    const air = (await getCameraPos(page)).y > 1.78
    if (air && !wasAir) bounces++   // the "left the ground" edge = a new jump in the series
    wasAir = air
  }
  await page.evaluate(() => {
    for (const code of ['Space', 'KeyW', 'KeyD']) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
  })
  expect(bounces).toBeGreaterThanOrEqual(2)   // the jump series continues while W+D are held
})
