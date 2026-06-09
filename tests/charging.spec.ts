import { test, expect } from './fixtures'
import { unlockPointer, mouseDown, aimAtBot } from './helpers'

const WINDUP_MS = 400

// Жмём ЛКМ до фактического старта заряда. Фикс флака: после forceLive фаза уже 'live', но заморозка
// снимается лишь на следующем Match.update (tickPhase → setFrozen(false)); если mousedown попал в это
// окно, startFiring — no-op. Поэтому диспатчим mousedown в polling, пока windup не начнётся (один заряд:
// как только phase=windup, условие возвращает true и больше не жмёт).
const fireUntilWindup = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => {
    if ((window as any).__debugWindup?.()) return true
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
    return false
  }, { timeout: 3000, polling: 30 })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
})

test('замедление — установившаяся скорость во время заряда ниже', async ({ page }) => {
  // Крейсерскую скорость (макс за окно удержания W) собираем В БРАУЗЕРЕ через rAF — latency playwright
  // не съедает короткое окно заряда (400 мс). Для charge сначала жмём ЛКМ до старта windup (устойчиво к
  // frozen-окну после forceLive), затем сэмплим скорость, пока заряд активен (после выстрела — break).
  const cruise = (charge: boolean) => page.evaluate(async (charging) => {
    const w = window as { __debugWindup?: () => boolean; __debugPlayerSpeed?: (id: number) => number | null }
    if (charging) {
      await new Promise<void>((res) => {
        const tick = () => {
          if (w.__debugWindup?.()) return res()
          window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
          requestAnimationFrame(tick)
        }
        tick()
      })
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    let max = 0
    const t0 = performance.now()
    while (performance.now() - t0 < 300) {
      if (charging && !w.__debugWindup?.()) break   // заряд кончился — дальше скорость вырастет, не учитываем
      max = Math.max(max, w.__debugPlayerSpeed?.(0) ?? 0)
      await new Promise((r) => requestAnimationFrame(r))
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }))
    return max
  }, charge)

  const normalSpeed = await cruise(false)
  await page.waitForTimeout(250)        // даём скорости упасть (трение) перед вторым замером
  const slowSpeed = await cruise(true)

  expect(normalSpeed).toBeGreaterThan(0)
  expect(slowSpeed).toBeLessThan(normalSpeed * 0.6)
})

test('замедление активно сразу после нажатия (выстрел ещё не произошёл)', async ({ page }) => {
  // fireUntilWindup резолвится ТОЛЬКО когда __debugWindup()===true (фаза windup — до выстрела).
  // Берём значение из самого resolve, без повторного evaluate (тот мог застать уже истёкший заряд).
  const windedUp = await fireUntilWindup(page)
  expect(await windedUp.jsonValue()).toBe(true)
})

test('повторный ЛКМ во время замедления не запускает второй заряд', async ({ page }) => {
  await aimAtBot(page)
  await fireUntilWindup(page)
  await mouseDown(page, 0)   // повторный ЛКМ во время заряда — не должен начать второй

  // Ждём первый выстрел по условию (устойчиво к лагу кадров), затем запас: будь второй заряд — он бы
  // тоже выстрелил за это время. Ровно 1 попадание → повторный ЛКМ второй заряд не запустил.
  await page.waitForFunction(() => ((window as any).__debugTargetHitCount ?? 0) >= 1, { timeout: 4000 })
  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1)
})
