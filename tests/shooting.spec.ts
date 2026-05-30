import { test, expect } from './fixtures'
import { unlockPointer, holdKey, mouseDown } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page)
  // Подходим к мишени
  await holdKey(page, 'KeyW', 700)
})

test('ЛКМ — луч уничтожает мишень', async ({ page }) => {
  await mouseDown(page, 0)
  await page.waitForTimeout(200)
  // Мишень должна исчезнуть — ищем оранжевый mesh через имя в сцене
  const targetAlive = await page.evaluate(() => {
    let found = false
    ;(window as any).__debugCamera?.parent?.traverse?.((obj: any) => {
      if (obj.name === 'target') found = true
    })
    return found
  })
  expect(targetAlive).toBe(false)
})

test('ЛКМ — beam-бар уходит на кулдаун', async ({ page }) => {
  const barsBefore = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('div[style]')]
      .map(el => el.style.width).filter(w => w === '100%').length
  )
  await mouseDown(page, 0)
  await page.waitForTimeout(100)
  const barsAfter = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('div[style]')]
      .map(el => el.style.width).filter(w => w === '100%').length
  )
  expect(barsAfter).toBeLessThan(barsBefore)
})

test('повторный выстрел во время кулдауна не срабатывает', async ({ page }) => {
  await mouseDown(page, 0)
  await page.waitForTimeout(100)
  // Мишень уничтожена — снова стреляем (должна остаться уничтоженной)
  await mouseDown(page, 0)
  await page.waitForTimeout(100)
  const targetAlive = await page.evaluate(() => {
    let found = false
    ;(window as any).__debugCamera?.parent?.traverse?.((obj: any) => {
      if (obj.name === 'target') found = true
    })
    return found
  })
  expect(targetAlive).toBe(false)
})
