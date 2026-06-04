import { test, expect } from './fixtures'
import { unlockPointer, holdKey, getCameraPos, aimAtBot } from './helpers'

// Физика Rapier (KinematicCharacterController) работает в реальном Chromium (WASM).

test('не проходит сквозь стену', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })   // человек смотрит вдоль −Z
  // Идём вбок (в стену x=+20): соперник спавнится прямо по курсу −Z (z=−5) и перекрыл бы путь к стене,
  // а боковая полоса (x) свободна — тестируем именно столкновение со стеной, а не с игроком.
  await holdKey(page, 'KeyD', 4500)
  const pos = await getCameraPos(page)
  expect(Math.abs(pos.x)).toBeLessThan(19.6) // капсула не пробила стену
  expect(pos.x).toBeGreaterThan(15)          // но дошёл до неё
})

test('не проходит сквозь бота', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  // Подходим к боту, постоянно подправляя прицел (homing), и упираемся в него.
  for (let i = 0; i < 8; i++) {
    await aimAtBot(page)
    await holdKey(page, 'KeyW', 500)
  }
  const dist = await page.evaluate(() => {
    const cam = (window as any).__debugCamera
    const b = (window as any).__debugBotPos[0]()
    return Math.hypot(cam.position.x - b.x, cam.position.z - b.z)
  })
  expect(dist).toBeGreaterThan(0.85)        // капсулы (r=0.5) не накладываются
  expect(dist).toBeLessThan(1.6)            // но подошли вплотную (контакт ~1.0)
})
