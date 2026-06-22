import { test, expect } from './fixtures'
import { waitForGame } from './helpers'

test('music starts in live: AudioContext active, sources scheduled', async ({ page }) => {
  await page.goto('/')
  await waitForGame(page, { difficulty: 'passive' })

  // Wait until the engine decodes the stems and schedules the first loop.
  await page.waitForFunction(
    () => ((window as any).__debugMusic?.()?.active?.length ?? 0) > 0,
    { timeout: 15000 },
  )

  const music = await page.evaluate(() => (window as any).__debugMusic())
  // Intro: on the first loop only kicks+bass play.
  const roles = music.active.map((id: string) => id.split('/')[0]).sort()
  expect(roles).toEqual(['bass', 'kicks'])
  expect(music.loopIndex).toBeGreaterThanOrEqual(0)
})
