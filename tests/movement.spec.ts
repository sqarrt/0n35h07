import { test, expect } from '@playwright/test'
import { unlockPointer, getCameraPos, holdKey } from './helpers'

const MOVE_MS = 400

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page)
})

test('W — движение вперёд (Z уменьшается)', async ({ page }) => {
  const before = await getCameraPos(page)
  await holdKey(page, 'KeyW', MOVE_MS)
  const after = await getCameraPos(page)
  expect(after.z).toBeLessThan(before.z)
})

test('S — движение назад (Z увеличивается)', async ({ page }) => {
  const before = await getCameraPos(page)
  await holdKey(page, 'KeyS', MOVE_MS)
  const after = await getCameraPos(page)
  expect(after.z).toBeGreaterThan(before.z)
})

test('A — стрейф влево (X уменьшается)', async ({ page }) => {
  const before = await getCameraPos(page)
  await holdKey(page, 'KeyA', MOVE_MS)
  const after = await getCameraPos(page)
  expect(after.x).toBeLessThan(before.x)
})

test('D — стрейф вправо (X увеличивается)', async ({ page }) => {
  const before = await getCameraPos(page)
  await holdKey(page, 'KeyD', MOVE_MS)
  const after = await getCameraPos(page)
  expect(after.x).toBeGreaterThan(before.x)
})

test('Y фиксирован на 1.7 при ходьбе', async ({ page }) => {
  await holdKey(page, 'KeyW', MOVE_MS)
  const pos = await getCameraPos(page)
  expect(pos.y).toBeCloseTo(1.7, 1)
})

test('Space — прыжок (Y поднимается выше 1.7)', async ({ page }) => {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })))
  await page.waitForTimeout(300)
  const peak = await getCameraPos(page)
  expect(peak.y).toBeGreaterThan(1.7)
})

test('Space — приземление (Y возвращается к 1.7)', async ({ page }) => {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })))
  await page.waitForTimeout(1200)
  const landed = await getCameraPos(page)
  expect(landed.y).toBeCloseTo(1.7, 1)
})
