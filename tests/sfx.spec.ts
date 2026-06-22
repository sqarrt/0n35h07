import { test, expect } from './fixtures'
import { unlockPointer, mouseDown, aimAtBot } from './helpers'

// Smoke: SFX engine loads, listener attaches to the camera, entering the match and firing don't crash audio.
test('SFX: match starts and firing does not crash audio', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  await aimAtBot(page)
  await mouseDown(page, 0)
  // Wait for the hit BY CONDITION (a fixed timeout flaked: under load charge+shot takes longer than WINDUP+300).
  // The hit happened → combat (and its SFX hook) ran without crashes.
  await expect.poll(
    () => page.evaluate(() => (window as never as { __debugTargetHitCount?: number }).__debugTargetHitCount ?? 0),
    { timeout: 6000 },
  ).toBeGreaterThanOrEqual(1)
  expect(errors.join('\n')).not.toMatch(/sfx|audio|AudioListener|PositionalAudio/i)
})
