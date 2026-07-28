import { test, expect } from './fixtures'
import type { Page, BrowserContext } from '@playwright/test'
import { revealRoomCode, joinByCode } from './helpers'

// Меш на трёх вкладках (?net=bc — шина): FFA-комната, старт, снапшоты ходят между всеми парами,
// уход одной вкладки не рушит матч у остальных. Боевых ассертов нет намеренно (флак) —
// протокол смерти закреплён юнитами (mesh.deathProtocol) и smoothness-спеком.

// Три страницы Rapier на тест — самый тяжёлый сьют в репо: под полной параллелью первый прогруз и
// рукопожатия не влезают в стандартный лимит. Тройной таймаут + последовательный режим внутри файла.
test.describe.configure({ mode: 'serial' })
test.slow()

async function fakeLock(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
}

async function threePeerFfa(context: BrowserContext) {
  const pages = [await context.newPage(), await context.newPage(), await context.newPage()]
  for (const p of pages) {
    await p.goto('/')
    await p.getByTestId('menu-play').click()
  }
  // Первый — создатель (детерминированно): переключает карусель на War и раскрывает свой код.
  const creator = pages[0]
  await creator.getByTestId('mode-tile-ffa').click()
  const code = await revealRoomCode(creator)
  // Гости заходят по коду и садятся на первые свободные слоты (1 и 2).
  await joinByCode(pages[1], code)
  await joinByCode(pages[2], code)
  await expect(creator.getByTestId('lobby-seat-2').locator('.lobby-nick')).toBeVisible({ timeout: 20000 })
  for (const p of [pages[1], pages[2]]) await expect(p.getByTestId('lobby-seat-2')).not.toHaveText('—', { timeout: 20000 })
  // READY у всех → матч.
  for (const p of pages) await expect(p.getByTestId('lobby-ready')).toBeEnabled({ timeout: 20000 })
  for (const p of pages) await p.getByTestId('lobby-ready').click()
  for (const p of pages) await p.waitForFunction(() => !!(window as any).__debugCamera, undefined, { timeout: 20000 })
  for (const p of pages) await p.evaluate(() => (window as any).__debugForceLive?.())
  for (const p of pages) await expect.poll(() => p.evaluate(() => (window as any).__debugPhase?.()), { timeout: 8000 }).toBe('live')
  return { pages, creator, others: pages.filter(p => p !== creator) }
}

const posOf = (page: Page, id: number) =>
  page.evaluate(pid => (window as any).__debugPlayerPos?.(pid) ?? null, id)

test('меш 3 вкладки: FFA стартует, движение каждого видно всем остальным', async ({ context }) => {
  const { pages, creator, others } = await threePeerFfa(context)

  // Двигаем СОЗДАТЕЛЯ (он всегда слот 0) — его игрок должен сдвинуться на экранах остальных.
  await fakeLock(creator)
  const before1 = await posOf(others[0], 0)
  const before2 = await posOf(others[1], 0)
  await creator.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })))
  await creator.waitForTimeout(1200)
  await creator.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))
  const moved = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
  await expect.poll(async () => moved(before1, await posOf(others[0], 0)), { timeout: 8000 }).toBeGreaterThan(1)
  await expect.poll(async () => moved(before2, await posOf(others[1], 0)), { timeout: 8000 }).toBeGreaterThan(1)

  // И в обратную сторону: третий подключившийся (всегда слот 2) виден создателю — пары независимы, не звезда.
  const third = pages[2]
  await fakeLock(third)
  const seenByCreator = await posOf(creator, 2)
  await third.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })))
  await third.waitForTimeout(1200)
  await third.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))
  await expect.poll(async () => moved(seenByCreator, await posOf(creator, 2)), { timeout: 8000 }).toBeGreaterThan(1)
})

test('меш 3 вкладки: уход одного пира не рушит матч у остальных', async ({ context }) => {
  const { pages } = await threePeerFfa(context)
  await pages[2].close()   // третий пир исчезает (transport leave)
  // Матч у оставшихся жив (осталось 2 команды в ffa), фаза не ended ещё долго.
  await pages[0].waitForTimeout(2500)
  expect(await pages[0].evaluate(() => (window as any).__debugPhase?.())).toBe('live')
  expect(await pages[1].evaluate(() => (window as any).__debugPhase?.())).toBe('live')
})
