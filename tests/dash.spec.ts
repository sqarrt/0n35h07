import { test, expect } from './fixtures'
import { unlockPointer, holdKey, getCameraPos } from './helpers'

async function press(page: any, code: string) {
  await page.evaluate((c: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code)
}
async function release(page: any, code: string) {
  await page.evaluate((c: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), code)
}

test('Shift-рывок добавляет дистанцию к обычному W', async ({ page }) => {
  await page.goto('/'); await unlockPointer(page)
  const n0 = await getCameraPos(page)
  await holdKey(page, 'KeyW', 400)
  const n1 = await getCameraPos(page)
  const normal = Math.abs(n1.z - n0.z)

  await page.goto('/'); await unlockPointer(page)
  const d0 = await getCameraPos(page)
  await press(page, 'KeyW')
  await press(page, 'ShiftLeft')   // одиночный рывок
  await page.waitForTimeout(400)
  await release(page, 'KeyW'); await release(page, 'ShiftLeft')
  const d1 = await getCameraPos(page)
  const dashed = Math.abs(d1.z - d0.z)

  expect(dashed).toBeGreaterThan(normal + 1)   // рывок заметно дальше
})

test('Shift стоя на месте не двигает и не тратит рывок', async ({ page }) => {
  await page.goto('/'); await unlockPointer(page)
  const a = await getCameraPos(page)
  await press(page, 'ShiftLeft'); await page.waitForTimeout(300); await release(page, 'ShiftLeft')
  const b = await getCameraPos(page)
  expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.2)
})
