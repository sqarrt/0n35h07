import { test, expect } from './fixtures'
import { unlockPointer, holdKey, mouseDown } from './helpers'

// Выстрел происходит через 400ms после нажатия (замедление игрока)
const WINDUP_MS = 400
// Мишень стоит прямо перед игроком при движении вперёд
const BASE_URL = '/?static=1&targetPos=0,1,-8'

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL)
  await unlockPointer(page)
  // Подходим к мишени
  await holdKey(page, 'KeyW', 700)
})

test('ЛКМ — луч попадает в мишень', async ({ page }) => {
  await mouseDown(page, 0)
  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1)
})

test('ЛКМ — beam-бар уходит на кулдаун', async ({ page }) => {
  // Кулдаун виден по цвету SVG-кольца прицела: #0ff = готов, #066 = кулдаун
  const strokeBefore = await page.evaluate(() =>
    document.querySelector('svg circle[stroke-dasharray]')?.getAttribute('stroke')
  )
  await mouseDown(page, 0)
  await page.waitForTimeout(WINDUP_MS + 200)
  const strokeAfter = await page.evaluate(() =>
    document.querySelector('svg circle[stroke-dasharray]')?.getAttribute('stroke')
  )
  expect(strokeBefore).toBe('#0ff')
  expect(strokeAfter).toBe('#066')
})

test('повторный выстрел во время кулдауна не срабатывает', async ({ page }) => {
  await mouseDown(page, 0)
  await page.waitForTimeout(WINDUP_MS + 300) // первый выстрел
  await mouseDown(page, 0)                   // второй — должен быть заблокирован кулдауном
  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1) // только один успешный выстрел
})
