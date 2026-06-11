import { test, expect } from './fixtures'
import { unlockPointer, mouseDown, aimAtBot } from './helpers'

const WINDUP_MS = 400

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  await aimAtBot(page)
})

test('ЛКМ — луч попадает в мишень', async ({ page }) => {
  await mouseDown(page, 0)
  await page.waitForTimeout(WINDUP_MS + 300)
  const hits = await page.evaluate(() => (window as any).__debugTargetHitCount ?? 0)
  expect(hits).toBe(1)
})

test('ЛКМ — beam-бар уходит на кулдаун', async ({ page }) => {
  const stroke = () => page.evaluate(() =>
    document.querySelector('svg circle[stroke-dasharray]')?.getAttribute('stroke')
  )
  // Прицел появляется асинхронно после входа в live — дожидаемся готового бара (#0ff),
  // а не предполагаем, что он уже в DOM (флак: strokeBefore был undefined).
  await expect.poll(stroke).toBe('#0ff')
  await mouseDown(page, 0)
  // Конец заряда → выстрел → бар на кулдауне. #066 держится BEAM_COOLDOWN (1500мс) — поллинг
  // окно не пропустит. Жёсткий waitForTimeout ловил кадры, когда заряд ещё шёл (флак: #0ff).
  await expect.poll(stroke, { timeout: 5000 }).toBe('#066')
})
// Примечание: «повторный выстрел в кулдауне не срабатывает» — чистая логика кулдауна,
// покрыта BeamWeapon.test («повторный beginWindup во время кулдауна игнорируется»).
