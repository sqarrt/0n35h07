import { test, expect } from '@playwright/test'
import { waitForGame } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('стартовый экран — оверлей и подсказки', async ({ page }) => {
  await expect(page.getByText('ONESHOT')).toBeVisible()
  await expect(page.getByText('Click to play')).toBeVisible()
  await expect(page.getByText('ЛКМ — beam')).toBeVisible()
  await expect(page.getByText('Space — jump')).toBeVisible()
})

test('сцена рендерится без ошибок', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.waitForTimeout(500)
  expect(errors).toHaveLength(0)
})

test('HUD бары полные при старте', async ({ page }) => {
  const bars = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('div[style]')]
      .map(el => el.style.width)
      .filter(w => w === '100%')
  )
  expect(bars.length).toBeGreaterThanOrEqual(2)
})

test('canvas рендерится', async ({ page }) => {
  await waitForGame(page)
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  const engine = await canvas.getAttribute('data-engine')
  expect(engine).toContain('three.js')
})
