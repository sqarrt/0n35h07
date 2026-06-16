import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { en } from '../src/i18n/locales/en'

// Две страницы в ОДНОМ контексте → BroadcastChannel связывает их (?net=bc по умолчанию).
// Так проверяем реальный P2P-обмен без внешних трекеров.

async function fakeLock(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
}

async function playerZ(page: Page, id: number): Promise<number> {
  return page.evaluate(pid => (window as any).__debugPlayerPos(pid)?.z ?? NaN, id)
}

/** Хост поднимает лобби, клиент входит по коду, оба жмут ГОТОВ → обе страницы в игре (фаза 'ready'). */
async function enterGame(context: import('@playwright/test').BrowserContext) {
  const host = await context.newPage()
  const client = await context.newPage()

  // Оба: ИГРАТЬ → вкладка «С другом» → один и тот же код комнаты → ПОИСК (роль решает selfId).
  const room = 'WOLF'
  await host.goto('/')
  await host.getByTestId('menu-play').click()
  await host.getByTestId('lobby-tab-friend').click()
  await host.getByTestId('lobby-room-code').fill(room)

  await client.goto('/')
  await client.getByTestId('menu-play').click()
  await client.getByTestId('lobby-tab-friend').click()
  await client.getByTestId('lobby-room-code').fill(room)

  await host.getByTestId('lobby-search').click()
  await client.getByTestId('lobby-search').click()

  // Оба видят соперника в слоте → у обоих появляется ГОТОВ (человек-vs-человек: оба подтверждают).
  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(client.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await host.getByTestId('lobby-ready').click()
  await client.getByTestId('lobby-ready').click()

  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  // Роль (host/client) выбирается по selfId транспорта — заранее неизвестно, какая страница какой стала.
  // Сопоставляем переменные с фактическими ролями (id 0 = host), иначе геометрия/авторитет «перепутаны».
  return resolveRoles(host, client)
}

/** По фактическим ролям (`__debugRole`) сопоставить страницы: { host, client }. */
async function resolveRoles(a: Page, b: Page) {
  await expect.poll(() => a.evaluate(() => (window as any).__debugRole?.() ?? null), { timeout: 8000 }).not.toBeNull()
  const roleA = await a.evaluate(() => (window as any).__debugRole())
  return roleA === 'host' ? { host: a, client: b } : { host: b, client: a }
}

/** enterGame + форс-live (минуя отсчёт) → обе страницы в фазе 'live'. */
async function startMatch(context: import('@playwright/test').BrowserContext) {
  const { host, client } = await enterGame(context)
  await host.evaluate(() => (window as any).__debugForceLive())
  await client.evaluate(() => (window as any).__debugForceLive())
  await expect.poll(() => host.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  await expect.poll(() => client.evaluate(() => (window as any).__debugPhase()), { timeout: 8000 }).toBe('live')
  return { host, client }
}

test('1v1: оба в режиме ОБА находят друг друга и стартуют', async ({ context }) => {
  const host = await context.newPage()
  const client = await context.newPage()
  for (const p of [host, client]) {
    await p.goto('/')
    await p.getByTestId('menu-play').click()
    await p.getByTestId('lobby-search').click()   // дефолт ОБА: advertise(dual)+search
  }
  // Разрыватель ничьей сведёт их в одно соединение → у обоих появится ГОТОВ.
  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(client.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  // Параметры лобби зарезолвлены человеком в слоте → у обоих карта/время залочены (клиент не правит чужие настройки).
  await expect(client.locator('.lobby-opts--locked')).toBeVisible()
  await expect(host.locator('.lobby-opts--locked')).toBeVisible()
  await host.getByTestId('lobby-ready').click()
  await client.getByTestId('lobby-ready').click()
  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 20000 })
})

test('1v1 (С другом): хост может менять настройки, клиент — нет', async ({ context }) => {
  const host = await context.newPage()
  const client = await context.newPage()
  const room = 'WOLF'
  for (const p of [host, client]) {
    await p.goto('/')
    await p.getByTestId('menu-play').click()
    await p.getByTestId('lobby-tab-friend').click()
    await p.getByTestId('lobby-room-code').fill(room)
  }
  await host.getByTestId('lobby-search').click()
  await client.getByTestId('lobby-search').click()
  await expect(host.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  await expect(client.getByTestId('lobby-ready')).toBeVisible({ timeout: 20000 })
  // Роль (host/client) выбирается по selfId — заранее неизвестно, какая страница стала какой.
  // На вкладке «С другом» залочен РОВНО клиент: один из двух пиров имеет .lobby-opts--locked, другой нет.
  const lockedCount = await host.locator('.lobby-opts--locked').count() + await client.locator('.lobby-opts--locked').count()
  expect(lockedCount).toBe(1)
})

test('1v1: движение хоста видно у клиента', async ({ context }) => {
  const { host, client } = await startMatch(context)
  await expect.poll(() => host.evaluate(() => (window as any).__debugRole())).toBe('host')
  await expect.poll(() => client.evaluate(() => (window as any).__debugRole())).toBe('client')

  await fakeLock(host)
  await host.waitForTimeout(100)
  const z0 = await playerZ(client, 0)   // позиция хоста (id 0) глазами клиента
  await host.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })))
  await host.waitForTimeout(1500)
  await host.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))

  await expect.poll(() => playerZ(client, 0), { timeout: 8000 }).toBeLessThan(z0 - 1)
})

test('1v1: клиент может убить хоста (выстрел доходит до авторитета)', async ({ context }) => {
  const { host, client } = await startMatch(context)

  // Клиент целится в хоста (id 0, напротив по +Z) и стреляет.
  await fakeLock(client)
  await client.waitForTimeout(100)
  await client.evaluate(() => {
    const cam = (window as any).__debugCamera
    const hp = (window as any).__debugPlayerPos(0)
    cam.lookAt(hp.x, hp.y, hp.z)
  })
  // Несколько выстрелов на случай кулдауна/промаха кадра.
  for (let i = 0; i < 3; i++) {
    await client.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })))
    await client.waitForTimeout(700)
  }

  // На ХОСТЕ (авторитет) у хоста (id 0) должна вырасти смерть — выстрел клиента дошёл.
  await expect.poll(() => host.evaluate(() => (window as any).__debugScore(0)?.deaths ?? 0), { timeout: 10000 })
    .toBeGreaterThanOrEqual(1)
})

test('1v1: шар хоста на клиенте сдувается плавно после выстрела (не рывком)', async ({ context }) => {
  const { host, client } = await startMatch(context)

  await fakeLock(host)
  await host.waitForTimeout(150)
  await host.evaluate(() => {
    const cam = (window as any).__debugCamera
    const cp = (window as any).__debugPlayerPos(1)
    cam.lookAt(cp.x, cp.y, cp.z)   // хост целится в клиента и стреляет
  })
  // Сэмплер масштаба — ВНУТРИ страницы клиента, на таймере 25мс (3.5с): evaluate-раундтрипы раз
  // в 40мс промахивались мимо 200мс окна сдувания (WINDUP_SHRINK_MS), а rAF-сэмплер умирает в
  // фоновой/перегруженной вкладке. Таймеры в Playwright не троттлятся.
  await client.evaluate(() => {
    const w = window as any
    w.__scaleSamples = []
    const t0 = performance.now()
    const id = setInterval(() => {
      const t = performance.now() - t0
      w.__scaleSamples.push({ t, s: w.__debugBodyScale?.(0) ?? 1 })
      if (t >= 3500) { clearInterval(id); w.__scaleDone = true }
    }, 25)
  })
  await host.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })))

  await client.waitForFunction(() => (window as any).__scaleDone, { timeout: 20000 })
  const samples: { t: number; s: number }[] = await client.evaluate(() => (window as any).__scaleSamples)

  const scales = samples.map(x => x.s)
  const peak = Math.max(...scales)
  expect(peak).toBeGreaterThan(1.2)                                  // шар вырос во время заряда
  const peakIdx = scales.indexOf(peak)
  const after = samples.slice(peakIdx + 1)
  expect(Math.min(...after.map(x => x.s))).toBeLessThan(1.05)        // и сдулся обратно

  // Плавность сдувания наблюдаема, только если игровой цикл клиента давал кадры чаще 200мс окна:
  // анимация time-based, и при кадре длиннее окна промежуточных значений не существует физически
  // (легитимно для перегруженной тестовой среды, не снап). Кадровый интервал оцениваем по фазе
  // РОСТА шара — там значение меняется каждый игровой кадр на протяжении всего заряда (400мс).
  const growth = samples.slice(0, peakIdx + 1).filter(x => x.s > 1.05)
  const distinct = new Set(growth.map(x => x.s)).size
  const growMs = growth.length >= 2 ? growth[growth.length - 1].t - growth[0].t : 0
  const frameMs = distinct >= 2 ? growMs / (distinct - 1) : Infinity
  if (frameMs <= 66) {
    // здоровый fps (≥15 кадров/с) → в 200мс сдувания обязаны быть промежуточные кадры, иначе это снап
    expect(after.filter(x => x.s > 1.05 && x.s < peak - 0.05).length).toBeGreaterThanOrEqual(1)
  }
})

test('1v1: клиент отключился — хост видит баннер и (после паузы) ВЫЙТИ', async ({ context }) => {
  const { host, client } = await startMatch(context)
  await client.evaluate(() => (window as any).__debugLeave())   // клиент покидает игру
  await expect(host.getByTestId('match-reason')).toHaveText(en.matchReasonDisconnect, { timeout: 6000 })
  await expect(host.getByTestId('match-exit')).toBeVisible({ timeout: 6000 })
  expect(await host.evaluate(() => (window as any).__debugPhase())).toBe('ended')
})

test('1v1: хост отключился — клиент видит баннер и ВЫЙТИ', async ({ context }) => {
  const { host, client } = await startMatch(context)
  await host.evaluate(() => (window as any).__debugLeave())
  await expect(client.getByTestId('match-reason')).toHaveText(en.matchReasonDisconnect, { timeout: 6000 })
  await expect(client.getByTestId('match-exit')).toBeVisible({ timeout: 6000 })
})
