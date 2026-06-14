import { test, expect } from './fixtures'
import type { Page, BrowserContext } from '@playwright/test'

// Две страницы host/client через BroadcastChannel (?net=bc). Боёвку считает хост, событие kill (со streak/
// firstBlood) идёт на обе стороны → обе анонсируют. Проверяем стабильный сценарий: первый фраг матча = CATALYST.
//
// Примечание: мульти-килл серии (DOUBLE/TRIPLE/…) и сброс подсветки при смерти НЕ покрыты e2e — убийства
// через две фоново-троттлящиеся Chromium-вкладки нестабильны по таймингу (особенно несколько подряд).
// Числовая логика серий (streakTier/announceKind/слова/звуки) полностью покрыта юнитами (tests/unit/streak.test.ts).

// Явные роли (host=id0, client=id1) — детерминированно, как в multiplayer.spec (а не режим ОБА по коду).
async function startMatch(context: BrowserContext) {
  const host = await context.newPage()
  const client = await context.newPage()

  await host.goto('/')
  await host.getByTestId('menu-play').click()
  await host.getByTestId('lobby-other-toggle').click()   // режим 'оба' по умолчанию уже хостит комнату
  const code = await host.getByTestId('lobby-code-input').inputValue()

  await client.goto('/')
  await client.getByTestId('menu-play').click()
  await client.getByTestId('lobby-other-toggle').click()
  await client.getByTestId('lobby-role-client').click()
  await client.getByTestId('lobby-code-input').fill(code)
  await client.getByTestId('lobby-search').click()

  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(client.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await host.getByTestId('lobby-ready').click(); await client.getByTestId('lobby-ready').click()
  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await host.evaluate(() => (window as any).__debugForceLive()); await client.evaluate(() => (window as any).__debugForceLive())
  await expect.poll(() => host.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  await expect.poll(() => client.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  return { host, client }
}

async function fakeLock(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
}

test('первый фраг матча → CATALYST (host-авторитет)', async ({ context }) => {
  test.setTimeout(90000)
  const { host, client } = await startMatch(context)

  // Клиент целится в хоста (id 0) и стреляет (несколько раз — на кулдаун/промах кадра, как в multiplayer.spec).
  await fakeLock(client)
  await client.waitForTimeout(100)
  await client.evaluate(() => { const cam = (window as any).__debugCamera; const hp = (window as any).__debugPlayerPos(0); cam.lookAt(hp.x, hp.y, hp.z) })
  for (let i = 0; i < 4; i++) {
    await client.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })))
    await client.waitForTimeout(700)
  }

  // Хост (авторитет) насчитал смерть → первый фраг матча, и в resolveCombat синхронно объявил серию.
  // Проверяем на хосте (считает локально, без сетевой задержки). Выстрелов несколько → киллов может быть
  // несколько (catalyst → double → …), поэтому проверяем ПЕРВЫЙ анонс истории — он всегда CATALYST.
  await expect.poll(() => host.evaluate(() => (window as any).__debugScore(0)?.deaths ?? 0), { timeout: 12000 }).toBeGreaterThanOrEqual(1)
  await expect.poll(() => host.evaluate(() => (window as any).__debugAnnounces?.[0]), { timeout: 8000 }).toBe('catalyst')
})
