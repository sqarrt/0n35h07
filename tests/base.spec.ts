import { test, expect } from './fixtures'
import { waitForGame, unlockPointer } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('scene renders without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.waitForTimeout(500)
  expect(errors).toHaveLength(0)
})

test('HUD bars full at start', async ({ page }) => {
  await unlockPointer(page)   // HUD is visible only when the pointer is locked
  const bars = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('div[style]')]
      .map(el => el.style.width)
      .filter(w => w === '100%')
  )
  expect(bars.length).toBeGreaterThanOrEqual(2)
})

test('canvas renders', async ({ page }) => {
  await waitForGame(page)
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  const engine = await canvas.getAttribute('data-engine')
  expect(engine).toContain('three.js')
})
