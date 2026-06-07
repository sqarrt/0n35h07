import { test, expect } from './fixtures'
import { waitForGame } from './helpers'

test('музыка стартует в live: AudioContext активен, источники запланированы', async ({ page }) => {
  await page.goto('/')
  await waitForGame(page, { difficulty: 'passive' })

  // Ждём, пока движок задекодит стемы и запланирует первый луп.
  await page.waitForFunction(
    () => ((window as any).__debugMusic?.()?.active?.length ?? 0) > 0,
    { timeout: 15000 },
  )

  const music = await page.evaluate(() => (window as any).__debugMusic())
  // Интро: на первом лупе звучат только kicks+bass.
  const roles = music.active.map((id: string) => id.split('/')[0]).sort()
  expect(roles).toEqual(['bass', 'kicks'])
  expect(music.loopIndex).toBeGreaterThanOrEqual(0)
})
