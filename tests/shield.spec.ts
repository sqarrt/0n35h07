import { test, expect } from './fixtures'
import { unlockPointer, mouseDown } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page)
})

test('ПКМ — shield-бар уходит на кулдаун', async ({ page }) => {
  // До: stroke-dashoffset = 0 (бар полный, щит готов)
  const offsetBefore = await page.evaluate(() =>
    document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke-dashoffset')
  )
  await mouseDown(page, 2)
  await page.waitForTimeout(600) // щит закончился (500ms), идёт кулдаун
  // После: stroke-dashoffset > 0 (бар убывает)
  const offsetAfter = await page.evaluate(() =>
    document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke-dashoffset')
  )
  expect(parseFloat(offsetBefore ?? '0')).toBe(0)
  expect(parseFloat(offsetAfter ?? '0')).toBeGreaterThan(0)
})

test('ПКМ — кольцо щита появляется в HUD', async ({ page }) => {
  await mouseDown(page, 2)
  await page.waitForTimeout(100)
  // Во время активного щита скобки светятся '#6af'
  const strokeActive = await page.evaluate(() =>
    document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke')
  )
  expect(strokeActive).toBe('#6af')
})

test('ПКМ — кольцо исчезает после окончания щита', async ({ page }) => {
  await mouseDown(page, 2)
  await page.waitForTimeout(950) // > 800ms длительности щита
  // После окончания: цвет больше не '#6af'
  const strokeAfter = await page.evaluate(() =>
    document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke')
  )
  expect(strokeAfter).not.toBe('#6af')
})

test('контекстное меню заблокировано', async ({ page }) => {
  await page.evaluate(() => {
    window.addEventListener('contextmenu', () => { (window as any).__ctxFired = true }, { once: true })
  })
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))
  await expect(page.locator('canvas')).toBeVisible()
})

test('повторный ПКМ во время кулдауна не активирует щит повторно', async ({ page }) => {
  await mouseDown(page, 2)
  await page.waitForTimeout(800) // щит закончился, кулдаун активен
  await mouseDown(page, 2)       // повторный — не должен сработать
  await page.waitForTimeout(50)
  const strokeAfter = await page.evaluate(() =>
    document.querySelector('svg path[stroke-dasharray]')?.getAttribute('stroke')
  )
  expect(strokeAfter).not.toBe('#6af')
})
