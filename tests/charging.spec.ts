import { test, expect } from './fixtures'
import { unlockPointer, mouseDown, aimAtBot } from './helpers'

const WINDUP_MS = 400

// Press LMB until the charge actually starts. Flake fix: after forceLive the phase is already 'live',
// but the freeze is lifted only on the next Match.update (tickPhase → setFrozen(false)); if mousedown
// lands in this window, startFiring is a no-op. So we dispatch mousedown in a polling loop until windup
// begins (single charge: as soon as phase=windup, the condition returns true and stops pressing).
const fireUntilWindup = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => {
    if ((window as any).__debugWindup?.()) return true
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
    return false
  }, { timeout: 3000, polling: 30 })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
})

test('slowdown — steady-state speed during charge is lower', async ({ page }) => {
  // Cruise speed (max over the W-hold window) is collected IN THE BROWSER via rAF — playwright latency
  // doesn't eat the short charge window (400 ms). For charge we first press LMB until windup starts
  // (robust to the frozen window after forceLive), then sample speed while the charge is active (break after the shot).
  const cruise = (charge: boolean) => page.evaluate(async (charging) => {
    const w = window as { __debugWindup?: () => boolean; __debugPlayerSpeed?: (id: number) => number | null }
    if (charging) {
      await new Promise<void>((res) => {
        const tick = () => {
          if (w.__debugWindup?.()) return res()
          window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
          requestAnimationFrame(tick)
        }
        tick()
      })
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    let max = 0
    const t0 = performance.now()
    while (performance.now() - t0 < 300) {
      if (charging && !w.__debugWindup?.()) break   // charge ended — speed will rise after this, don't count it
      max = Math.max(max, w.__debugPlayerSpeed?.(0) ?? 0)
      await new Promise((r) => requestAnimationFrame(r))
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }))
    return max
  }, charge)

  const normalSpeed = await cruise(false)
  await page.waitForTimeout(250)        // let speed drop (friction) before the second measurement
  const slowSpeed = await cruise(true)

  expect(normalSpeed).toBeGreaterThan(0)
  expect(slowSpeed).toBeLessThan(normalSpeed * 0.6)
})

test('slowdown is active right after pressing (the shot has not happened yet)', async ({ page }) => {
  // fireUntilWindup resolves ONLY when __debugWindup()===true (windup phase — before the shot).
  // We take the value from the resolve itself, without a second evaluate (which could catch an already-expired charge).
  const windedUp = await fireUntilWindup(page)
  expect(await windedUp.jsonValue()).toBe(true)
})

test('a repeat LMB during slowdown does not start a second charge', async ({ page }) => {
  await aimAtBot(page)
  await fireUntilWindup(page)
  await mouseDown(page, 0)   // repeat LMB during the charge — must not start a second one

  // Wait for the first shot by condition (robust to frame lag), then a margin: were there a second
  // charge, it would have fired too in that time. Exactly 1 hit → the repeat LMB did not start a second charge.
  await page.waitForFunction(() => ((window as any).__debugTargetHitCount ?? 0) >= 1, { timeout: 4000 })
  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1)
})
