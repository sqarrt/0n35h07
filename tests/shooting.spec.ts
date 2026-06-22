import { test, expect } from './fixtures'
import { unlockPointer, mouseDown, aimAtBot } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  await aimAtBot(page)
})

test('LMB — beam hits the target', async ({ page }) => {
  await mouseDown(page, 0)
  // Wait for the hit by condition (a fixed timeout flaked under load). One shot → exactly one hit.
  await expect.poll(() => page.evaluate(() => (window as any).__debugTargetHitCount ?? 0), { timeout: 6000 }).toBe(1)
})

test('third person — LMB hits the bot (hit along the camera ray, no muzzle↔camera parallax)', async ({ page }) => {
  // Switch to TP (KeyV) — the hit ray goes from the camera through the sight, visual from the muzzle.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true })))
  await page.waitForTimeout(200)
  // Aim at the CENTER of the bot (in TP the hit is precise = under the crosshair; aimAtBot uses +0.5 — above the capsule).
  await page.evaluate(() => {
    const cam = (window as any).__debugCamera
    const p = (window as any).__debugBotPos?.[0]?.()
    if (cam && p) cam.lookAt(p.x, p.y, p.z)
  })
  await page.waitForTimeout(200)
  await mouseDown(page, 0)
  await expect.poll(() => page.evaluate(() => (window as any).__debugTargetHitCount ?? 0), { timeout: 6000 }).toBe(1)
})

test('LMB — beam bar goes on cooldown', async ({ page }) => {
  const stroke = () => page.evaluate(() =>
    document.querySelector('svg circle[stroke-dasharray]')?.getAttribute('stroke')
  )
  // The sight appears asynchronously after entering live — we wait for the ready bar (#0ff),
  // rather than assuming it's already in the DOM (flake: strokeBefore was undefined).
  await expect.poll(stroke).toBe('#0ff')
  await mouseDown(page, 0)
  // End of charge → shot → bar on cooldown. #066 holds for BEAM_COOLDOWN (1500ms) — polling
  // won't miss the window. A hard waitForTimeout caught frames while the charge was still going (flake: #0ff).
  await expect.poll(stroke, { timeout: 5000 }).toBe('#066')
})
// Note: "repeat shot during cooldown doesn't fire" — pure cooldown logic,
// covered by BeamWeapon.test ("repeat beginWindup during cooldown is ignored").
