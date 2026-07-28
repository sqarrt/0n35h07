import { test, expect } from './fixtures'
import { unlockPointer, mouseDown } from './helpers'

const ringStroke = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke'))
const ringOffset = (page: import('@playwright/test').Page) =>
  page.evaluate(() => parseFloat(document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke-dashoffset') ?? '0'))

test('shield lifecycle in HUD: activation → fade → reactivation blocked during cooldown → bar', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })   // single session, inert bot

  expect(await ringOffset(page)).toBe(0)                 // bar full, shield ready

  await mouseDown(page, 2)
  // Activation renders asynchronously: a hard 100ms under load caught the still-inactive ring (flake).
  // The active state holds for SHIELD_DURATION (800ms) — polling won't miss it.
  await expect.poll(() => ringStroke(page)).toBe('#6af')             // ring active

  await expect.poll(() => ringStroke(page), { timeout: 5000 }).not.toBe('#6af')   // ring faded after 800ms
  expect(await ringOffset(page)).toBeGreaterThan(0)      // bar went on cooldown (2000ms — we make it)

  await mouseDown(page, 2)                               // repeat during cooldown — doesn't activate (logic covered by Shield.test)
  await page.waitForTimeout(150)
  expect(await ringStroke(page)).not.toBe('#6af')        // ring did not return
  expect(await ringOffset(page)).toBeGreaterThan(0)      // and we're still in cooldown — the check didn't degenerate
})
