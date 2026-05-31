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

test('1v1: клиент подключается, хост стартует, движение хоста видно у клиента', async ({ context }) => {
  const host = await context.newPage()
  const client = await context.newPage()

  // Хост создаёт лобби и читает код.
  await host.goto('/')
  await host.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(host.getByRole('heading', { name: 'ЛОББИ' })).toBeVisible()
  const codeText = await host.getByText(/КОД:/).textContent()
  const code = codeText!.match(/КОД:\s*([A-Z0-9]{4})/)![1]

  // Клиент заходит по коду → хост видит второго игрока.
  await client.goto(`/#${code}`)
  await expect(host.getByText('ИГРОКОВ: 2')).toBeVisible({ timeout: 10000 })
  await expect(client.getByText('ОЖИДАНИЕ ХОСТА…')).toBeVisible({ timeout: 10000 })

  // Старт — обе стороны входят в игру (даём presence устаканиться перед кликом).
  await host.waitForTimeout(300)
  const startBtn = host.getByText('НАЧАТЬ')
  await expect(startBtn).toBeVisible()
  await startBtn.click()
  await host.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 15000 })
  await client.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 15000 })
  await expect.poll(() => host.evaluate(() => (window as any).__debugRole())).toBe('host')
  await expect.poll(() => client.evaluate(() => (window as any).__debugRole())).toBe('client')

  // Хост захватывает указатель и идёт вперёд (W → −Z).
  await fakeLock(host)
  await host.waitForTimeout(100)
  const z0 = await playerZ(client, 0)   // позиция хоста (id 0) глазами клиента
  await host.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })))
  await host.waitForTimeout(1500)
  await host.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))

  // Клиент должен увидеть смещение аватара хоста вперёд (z уменьшился).
  await expect.poll(() => playerZ(client, 0), { timeout: 8000 }).toBeLessThan(z0 - 1)
})
