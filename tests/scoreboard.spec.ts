import { test, expect } from './fixtures'
import { unlockPointer, aimAtBot, mouseDown } from './helpers'

test('Tab показывает таблицу K/D с игроками', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  await page.waitForTimeout(200)   // кадры отправляют SET_SCORES
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true })))
  await expect(page.getByText('Игрок', { exact: true })).toBeVisible()
  await expect(page.getByText('Бот', { exact: true })).toBeVisible()
  // Отпустили Tab — таблица скрывается
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Tab', bubbles: true })))
  await expect(page.getByText('Игрок', { exact: true })).toHaveCount(0)
})

test('лента убийств показывает фраг', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  await aimAtBot(page)
  await mouseDown(page, 0)
  await page.waitForTimeout(800)   // windup + выстрел
  await expect(page.getByText('Бот', { exact: true })).toBeVisible()   // запись в ленте
})
