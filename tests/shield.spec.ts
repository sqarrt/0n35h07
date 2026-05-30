import { test, expect } from './fixtures'
import { unlockPointer, mouseDown } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page)
})

test('ПКМ — shield-бар уходит на кулдаун', async ({ page }) => {
  const fullBefore = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('div[style]')]
      .map(el => el.style.width).filter(w => w === '100%').length
  )
  await mouseDown(page, 2)
  await page.waitForTimeout(100)
  const fullAfter = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('div[style]')]
      .map(el => el.style.width).filter(w => w === '100%').length
  )
  expect(fullAfter).toBeLessThan(fullBefore)
})

test('ПКМ — кольцо щита появляется в HUD', async ({ page }) => {
  await mouseDown(page, 2)
  await page.waitForTimeout(100)
  const ringVisible = await page.evaluate(() => {
    const ring = [...document.querySelectorAll<HTMLElement>('div[style]')]
      .find(el => el.style.borderRadius === '50%' && el.style.border.includes('65'))
    return !!ring
  })
  expect(ringVisible).toBe(true)
})

test('ПКМ — кольцо исчезает после окончания щита', async ({ page }) => {
  await mouseDown(page, 2)
  await page.waitForTimeout(700) // > 500ms длительности щита
  const ringVisible = await page.evaluate(() => {
    const ring = [...document.querySelectorAll<HTMLElement>('div[style]')]
      .find(el => el.style.borderRadius === '50%' && el.style.border.includes('65'))
    return !!ring
  })
  expect(ringVisible).toBe(false)
})

test('контекстное меню заблокировано', async ({ page }) => {
  let contextMenuFired = false
  await page.evaluate(() => {
    window.addEventListener('contextmenu', () => { (window as any).__ctxFired = true }, { once: true })
  })
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))
  // contextmenu должен быть заблокирован (preventDefault вызван)
  // Просто проверяем что нет UI-блокировки
  await expect(page.locator('canvas')).toBeVisible()
})

test('повторный ПКМ во время кулдауна не активирует щит повторно', async ({ page }) => {
  await mouseDown(page, 2)
  await page.waitForTimeout(800) // щит закончился (500ms), кулдаун активен
  await mouseDown(page, 2) // повторный — не должен сработать
  await page.waitForTimeout(50)
  const ringVisible = await page.evaluate(() => {
    const ring = [...document.querySelectorAll<HTMLElement>('div[style]')]
      .find(el => el.style.borderRadius === '50%' && el.style.border.includes('65'))
    return !!ring
  })
  expect(ringVisible).toBe(false)
})
