import { test, expect } from './fixtures'
import { unlockPointer, holdKey, getCameraPos, aimAtBot } from './helpers'

// Rapier physics (KinematicCharacterController) runs in real Chromium (WASM).

test('does not pass through a wall', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })   // the human faces along −Z
  // Move sideways (into the wall at x=+20): the opponent spawns straight ahead along −Z (z=−5) and would
  // block the path to the wall, while the side lane (x) is clear — so we test the wall collision, not the player one.
  await holdKey(page, 'KeyD', 4500)
  const pos = await getCameraPos(page)
  expect(Math.abs(pos.x)).toBeLessThan(19.6) // the capsule didn't punch through the wall
  expect(pos.x).toBeGreaterThan(15)          // but reached it
})

test('knockback from the bot instead of collision', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  // There's no collision between players — instead a sharp knockback when bodies overlap (maybeKnockback).
  // We approach the bot (homing aim) and press W; the knockback firing is deterministically recorded by
  // the __debugKnockCount counter. Spawns are far apart (≈32 along Z on os_arena) — keep going until we hit.
  // Shorter step + more frequent re-aim (denser homing) and more attempts: under CPU contention (workers:4)
  // a rare convergence miss over a long 500ms step gave knocks=0. The loop exits on the first knockback.
  const knockCount = () => page.evaluate(() => window.__debugKnockCount ?? 0)
  let knocks = 0
  for (let i = 0; i < 40 && knocks === 0; i++) {
    await aimAtBot(page)
    await holdKey(page, 'KeyW', 250)
    knocks = await knockCount()
  }
  expect(knocks).toBeGreaterThan(0)   // overlapping bodies produced an impulse knockback, not sticking/pass-through
})
