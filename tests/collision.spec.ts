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

test('отброс от бота вместо коллизии', async ({ page }) => {
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  // Коллизии между игроками нет — вместо неё резкий отброс при пересечении тел (maybeKnockback).
  // Подходим к боту (homing-прицел) и давим W; срабатывание отброса детерминированно фиксирует
  // счётчик __debugKnockCount. Спавны разнесены (≈32 по Z на os_arena) — идём дольше, пока не упрёмся.
  // Короче шаг + чаще перенаводимся (плотнее homing) и больше попыток: под CPU-контеншеном (workers:4)
  // редкий промах схождения за длинный 500мс-шаг давал knocks=0. Цикл выходит сразу при первом отбросе.
  const knockCount = () => page.evaluate(() => window.__debugKnockCount ?? 0)
  let knocks = 0
  for (let i = 0; i < 40 && knocks === 0; i++) {
    await aimAtBot(page)
    await holdKey(page, 'KeyW', 250)
    knocks = await knockCount()
  }
  expect(knocks).toBeGreaterThan(0)   // пересечение тел дало импульс-отброс, а не залипание/проход насквозь
})
