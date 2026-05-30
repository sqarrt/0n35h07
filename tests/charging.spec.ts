import { test, expect } from './fixtures'
import { unlockPointer, holdKey, mouseDown, getCameraPos } from './helpers'

const WINDUP_MS = 400
const BASE_URL = '/?static=1&targetPos=0,1,-8'

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL)
  await unlockPointer(page)
  await holdKey(page, 'KeyW', 700)
})

test('замедление — движение тормозит во время заряда', async ({ page }) => {
  // Нормальное движение без выстрела
  const before1 = await getCameraPos(page)
  await holdKey(page, 'KeyW', 300)
  const after1 = await getCameraPos(page)
  const normalDist = Math.abs(before1.z - after1.z)

  // Сбрасываем позицию
  await page.goto(BASE_URL)
  await unlockPointer(page)
  await holdKey(page, 'KeyW', 700)

  // Движение во время замедления
  const before2 = await getCameraPos(page)
  await mouseDown(page, 0) // начало замедления
  await holdKey(page, 'KeyW', 300) // двигаемся те же 300ms
  const after2 = await getCameraPos(page)
  const slowDist = Math.abs(before2.z - after2.z)

  // Во время замедления расстояние должно быть заметно меньше
  expect(slowDist).toBeLessThan(normalDist * 0.6)
})

test('замедление активно сразу после нажатия (выстрел ещё не произошёл)', async ({ page }) => {
  await mouseDown(page, 0)
  await page.waitForTimeout(50) // ждём меньше чем BEAM_WINDUP (400ms)

  const isWindingUp = await page.evaluate(() => (window as any).__debugWindup?.())
  expect(isWindingUp).toBe(true)
})

test('задержка выстрела — попадание только после окончания замедления', async ({ page }) => {
  await mouseDown(page, 0)
  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1)
})

test('повторный ЛКМ во время замедления не запускает второй заряд', async ({ page }) => {
  await mouseDown(page, 0) // первый — начало замедления
  await page.waitForTimeout(50)
  await mouseDown(page, 0) // второй — должен игнорироваться

  const isWindup = await page.evaluate(() => (window as any).__debugWindup?.())
  expect(isWindup).toBe(true)

  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1) // только один выстрел несмотря на два нажатия
})
