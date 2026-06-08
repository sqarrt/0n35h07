import { test, expect } from './fixtures'
import { unlockPointer, mouseDown, aimAtBot } from './helpers'

const WINDUP_MS = 400

// Смоук: SFX-движок грузится, listener цепляется к камере, вход в матч и стрельба не роняют аудио.
test('SFX: матч стартует и стрельба не роняет аудио', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto('/')
  await unlockPointer(page, { difficulty: 'passive' })
  await aimAtBot(page)
  await mouseDown(page, 0)
  await page.waitForTimeout(WINDUP_MS + 300)
  // попадание состоялось — значит боёвка (и её SFX-хук) отработала без падений
  const hits = await page.evaluate(() => (window as never as { __debugTargetHitCount?: number }).__debugTargetHitCount ?? 0)
  expect(hits).toBeGreaterThanOrEqual(1)
  expect(errors.join('\n')).not.toMatch(/sfx|audio|AudioListener|PositionalAudio/i)
})
