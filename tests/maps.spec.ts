import { test, expect } from './fixtures'

test('комната — выбор карты: плитка активна при клике', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-create-room').click()
  await expect(page.getByText('КОМНАТА', { exact: true })).toBeVisible()
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
  await page.getByTestId('menu-create-room').click()
  await page.getByRole('button', { name: /os_pillars/ }).click()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await page.getByText('НАЧАТЬ').click()

  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  // Применились спавны именно os_pillars (хост z ≈ 13, half=15), а не другой карты.
  const z = await page.evaluate(() => (window as any).__debugPlayerPos(0)?.z ?? NaN)
  expect(z).toBeGreaterThan(11)
  expect(z).toBeLessThan(15)
})

test('os_india: по рампе можно подняться на центральную площадку', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-create-room').click()
  await page.getByRole('button', { name: /os_india/ }).click()
  await page.getByText('ДОБАВИТЬ БОТА').click()
  await page.getByText('НАЧАТЬ').click()

  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', { timeout: 5000 })
  // «в игре» (фейк pointer lock) — иначе ввод игнорируется
  await page.evaluate(() => {
    const c = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => c, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
  // Идём вперёд (−Z, на длинный подъём) бёрстами, копим максимум высоты глаз (выходим, как поднялись).
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })))
  let maxY = 0
  for (let i = 0; i < 22 && maxY <= 3; i++) {
    await page.waitForTimeout(450)
    const y = await page.evaluate(() => (window as any).__debugPlayerPos(0)?.y ?? 0)
    if (y > maxY) maxY = y
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))
  // На земле глаз ≈ 1.7; поднявшись на площадку (верх y=3) — заметно выше.
  expect(maxY).toBeGreaterThan(3)
})
