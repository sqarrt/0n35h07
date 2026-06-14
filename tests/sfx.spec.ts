import { test, expect } from './fixtures'
import { unlockPointer, mouseDown, aimAtBot } from './helpers'

// Смоук: SFX-движок грузится, listener цепляется к камере, вход в матч и стрельба не роняют аудио.
test('SFX: матч стартует и стрельба не роняет аудио', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  await aimAtBot(page)
  await mouseDown(page, 0)
  // Попадание ждём ПО УСЛОВИЮ (фикс-таймаут флакал: под нагрузкой заряд+выстрел дольше WINDUP+300).
  // Попадание состоялось → боёвка (и её SFX-хук) отработала без падений.
  await expect.poll(
    () => page.evaluate(() => (window as never as { __debugTargetHitCount?: number }).__debugTargetHitCount ?? 0),
    { timeout: 6000 },
  ).toBeGreaterThanOrEqual(1)
  expect(errors.join('\n')).not.toMatch(/sfx|audio|AudioListener|PositionalAudio/i)
})
