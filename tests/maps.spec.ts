import { test, expect } from './fixtures'

test('лобби — выбор карты: плитка активна при клике', async ({ page }) => {
  await page.goto('/')
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('ЛОББИ', { exact: true })).toBeVisible()
  await expect(page.getByText('// КАРТА')).toBeVisible()

  // По умолчанию активна os_arena.
  const arena = page.getByRole('button', { name: /os_arena/ })
  await expect(arena).toHaveClass(/map-tile--on/)

  // Клик по плитке os_india → активной становится она, os_arena гаснет.
  await page.getByRole('button', { name: /os_india/ }).click()
  await expect(page.getByRole('button', { name: /os_india/ })).toHaveClass(/map-tile--on/)
  await expect(arena).not.toHaveClass(/map-tile--on/)
})

test('старт на выбранной карте применяет её спавны (os_pillars)', async ({ page }) => {
  await page.goto('/')
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await page.getByRole('button', { name: /os_pillars/ }).click()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await page.getByText('НАЧАТЬ').click()

  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  // Хост (id 0) спавнится в дальнем конце «os_pillars» (z ≈ 16), а не в арена-точке (z = 5).
  const z = await page.evaluate(() => (window as any).__debugPlayerPos(0)?.z ?? NaN)
  expect(z).toBeGreaterThan(14)
})
