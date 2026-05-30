import { test, expect } from './fixtures'
import { unlockPointer, holdKey, mouseDown, getCameraPos, aimAtBot } from './helpers'

const WINDUP_MS = 400

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
})

test('замедление — движение тормозит во время заряда', async ({ page }) => {
  // Оба замера при одинаковом направлении камеры (дефолт: прямо вперёд)
  const before1 = await getCameraPos(page)
  await holdKey(page, 'KeyW', 300)
  const after1 = await getCameraPos(page)
  const normalDist = Math.abs(before1.z - after1.z)

  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })

  const before2 = await getCameraPos(page)
  await mouseDown(page, 0)
  await holdKey(page, 'KeyW', 300)
  const after2 = await getCameraPos(page)
  const slowDist = Math.abs(before2.z - after2.z)

  expect(slowDist).toBeLessThan(normalDist * 0.6)
})

test('замедление активно сразу после нажатия (выстрел ещё не произошёл)', async ({ page }) => {
  await mouseDown(page, 0)
  await page.waitForTimeout(50)
  const isWindingUp = await page.evaluate(() => (window as any).__debugWindup?.())
  expect(isWindingUp).toBe(true)
})

test('задержка выстрела — попадание только после окончания замедления', async ({ page }) => {
  await aimAtBot(page)
  await mouseDown(page, 0)
  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1)
})

test('повторный ЛКМ во время замедления не запускает второй заряд', async ({ page }) => {
  await aimAtBot(page)
  await mouseDown(page, 0)
  await page.waitForTimeout(50)
  await mouseDown(page, 0)

  const isWindup = await page.evaluate(() => (window as any).__debugWindup?.())
  expect(isWindup).toBe(true)

  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1)
})
