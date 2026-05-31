import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

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

/** Хост создаёт лобби, клиент входит по коду, хост стартует → обе страницы в игре. */
async function startMatch(context: import('@playwright/test').BrowserContext) {
  const host = await context.newPage()
  const client = await context.newPage()

  await host.goto('/')
  await host.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(host.getByRole('heading', { name: 'ЛОББИ' })).toBeVisible()
  const codeText = await host.getByText(/КОД:/).textContent()
  const code = codeText!.match(/КОД:\s*([A-Z0-9]{4})/)![1]

  await client.goto(`/#${code}`)
  await expect(host.getByText('ИГРОКОВ: 2')).toBeVisible({ timeout: 10000 })
  await expect(client.getByText('ОЖИДАНИЕ ХОСТА…')).toBeVisible({ timeout: 10000 })

  await host.waitForTimeout(300)
  await host.getByText('НАЧАТЬ').click()
  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 15000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 15000 })
  return { host, client }
}

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
