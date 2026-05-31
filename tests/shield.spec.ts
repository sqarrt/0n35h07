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
  await page.waitForTimeout(100)
  expect(await ringStroke(page)).toBe('#6af')            // кольцо активно

  await page.waitForTimeout(950)                         // > 800мс длительности
  expect(await ringStroke(page)).not.toBe('#6af')        // кольцо погасло
  expect(await ringOffset(page)).toBeGreaterThan(0)      // бар ушёл на кулдаун

  await mouseDown(page, 2)                               // повтор в кулдауне — не активирует (логику ловит Shield.test)
  await page.waitForTimeout(50)
  expect(await ringStroke(page)).not.toBe('#6af')        // кольцо не вернулось
})
