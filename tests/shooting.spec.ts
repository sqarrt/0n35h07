import { test, expect } from './fixtures'
import { unlockPointer, mouseDown, aimAtBot } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  await aimAtBot(page)
})

test('ЛКМ — луч попадает в мишень', async ({ page }) => {
  await mouseDown(page, 0)
  // Попадание ждём по условию (фикс-таймаут флакал под нагрузкой). Один выстрел → ровно одно попадание.
  await expect.poll(() => page.evaluate(() => (window as any).__debugTargetHitCount ?? 0), { timeout: 6000 }).toBe(1)
})

test('3-е лицо — ЛКМ попадает в бота (хит по лучу камеры, без параллакса дуло↔камера)', async ({ page }) => {
  // Переключаемся в TP (KeyV) — луч попадания идёт из камеры через мушку, визуал из дула.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true })))
  await page.waitForTimeout(200)
  // Целимся в ЦЕНТР бота (в TP хит точный = под перекрестием; aimAtBot берёт +0.5 — выше капсулы).
  await page.evaluate(() => {
    const cam = (window as any).__debugCamera
    const p = (window as any).__debugBotPos?.[0]?.()
    if (cam && p) cam.lookAt(p.x, p.y, p.z)
  })
  await page.waitForTimeout(200)
  await mouseDown(page, 0)
  await expect.poll(() => page.evaluate(() => (window as any).__debugTargetHitCount ?? 0), { timeout: 6000 }).toBe(1)
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
