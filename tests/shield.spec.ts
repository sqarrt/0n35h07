import { test, expect } from './fixtures'
import { unlockPointer, mouseDown } from './helpers'

const ringStroke = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke'))
const ringOffset = (page: import('@playwright/test').Page) =>
  page.evaluate(() => parseFloat(document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke-dashoffset') ?? '0'))

test('жизненный цикл щита в HUD: активация → гашение → блок реактивации в кулдауне → бар', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })   // одна сессия, инертный бот

  expect(await ringOffset(page)).toBe(0)                 // бар полный, щит готов

  await mouseDown(page, 2)
  // Активация рендерится асинхронно: жёсткие 100мс под нагрузкой ловили ещё неактивное кольцо (флак).
  // Активное состояние держится SHIELD_DURATION (800мс) — поллинг его не пропустит.
  await expect.poll(() => ringStroke(page)).toBe('#6af')             // кольцо активно

  await expect.poll(() => ringStroke(page), { timeout: 5000 }).not.toBe('#6af')   // кольцо погасло после 800мс
  expect(await ringOffset(page)).toBeGreaterThan(0)      // бар ушёл на кулдаун (2000мс — успеваем)

  await mouseDown(page, 2)                               // повтор в кулдауне — не активирует (логику ловит Shield.test)
  await page.waitForTimeout(150)
  expect(await ringStroke(page)).not.toBe('#6af')        // кольцо не вернулось
  expect(await ringOffset(page)).toBeGreaterThan(0)      // и мы всё ещё в кулдауне — проверка не выродилась
})
