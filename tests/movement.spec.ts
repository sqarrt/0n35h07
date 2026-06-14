import { test, expect } from './fixtures'
import { unlockPointer, getCameraPos, holdKey } from './helpers'

const MOVE_MS = 400

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })   // инертный бот: не мешает дельтам в общей сессии
})

test('WASD — четыре направления и фиксированная высота (одна сессия)', async ({ page }) => {
  // Камера по умолчанию смотрит вдоль −Z. Каждый сегмент короткий (≈2.8 ед) — до стен далеко.
  const fwd0 = await getCameraPos(page)
  await holdKey(page, 'KeyW', MOVE_MS)
  const fwd1 = await getCameraPos(page)
  expect(fwd1.z).toBeLessThan(fwd0.z)              // W — вперёд (Z уменьшается)

  await holdKey(page, 'KeyS', MOVE_MS)
  const back = await getCameraPos(page)
  expect(back.z).toBeGreaterThan(fwd1.z)           // S — назад (Z увеличивается)

  const strafe0 = await getCameraPos(page)
  await holdKey(page, 'KeyA', MOVE_MS)
  const left = await getCameraPos(page)
  expect(left.x).toBeLessThan(strafe0.x)           // A — стрейф влево (X уменьшается)

  await holdKey(page, 'KeyD', MOVE_MS)
  const right = await getCameraPos(page)
  expect(right.x).toBeGreaterThan(left.x)          // D — стрейф вправо (X увеличивается)

  expect(right.y).toBeCloseTo(1.7, 1)              // высота глаз фиксирована при ходьбе
})

test('Space — прыжок и приземление', async ({ page }) => {
  // Жмём Space (keydown), пока камера не поднимется (физика Rapier может ещё грузиться под нагрузкой).
  await page.waitForFunction(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    const cam = (window as any).__debugCamera
    return !!cam && cam.position.y > 1.75
  }, { timeout: 6000, polling: 100 })
  expect((await getCameraPos(page)).y).toBeGreaterThan(1.7)   // взлетел

  // ОТПУСКАЕМ Space — иначе удержание = auto-bhop, и игрок не приземлится.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })))
  // Приземление ждём ПО УСЛОВИЮ, а не фикс-таймаутом: под нагрузкой падение бывает дольше 1200мс (флак).
  await expect.poll(async () => (await getCameraPos(page)).y, { timeout: 6000 }).toBeCloseTo(1.7, 1)   // вернулся на землю
})

test('bhop — удержание Space даёт серию прыжков даже с W+D (без авто-повтора ОС)', async ({ page }) => {
  // Регрессия: раньше bhop держался на ОС-автоповторе Space, и W+D+Space его рвало. Теперь прыжок — held-ввод:
  // одно нажатие Space (без keyup) + W + D → keys.jump остаётся true → авто-прыжок на каждом приземлении.
  await page.evaluate(() => {
    for (const code of ['Space', 'KeyW', 'KeyD']) window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
  })
  let bounces = 0
  let wasAir = false
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(40)
    const air = (await getCameraPos(page)).y > 1.78
    if (air && !wasAir) bounces++   // фронт «оторвался от земли» = новый прыжок в серии
    wasAir = air
  }
  await page.evaluate(() => {
    for (const code of ['Space', 'KeyW', 'KeyD']) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
  })
  expect(bounces).toBeGreaterThanOrEqual(2)   // серия прыжков продолжается при зажатых W+D
})
