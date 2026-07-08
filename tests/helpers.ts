import { Page } from '@playwright/test'

export interface NavigateOpts {
  difficulty?: 'normal' | 'passive'
}

// Walks through the main menu if it's open: PLAY (Duel preset, we host a room) → "add a bot" zone of the
// free seat → (optional per-seat difficulty) → READY. 1v1: an opponent is required — a bot plays that role.
async function navigateThroughMenu(page: Page, opts: NavigateOpts = {}) {
  const menuVisible = await page.getByTestId('menu-play').isVisible().catch(() => false)
  if (!menuVisible) return
  await page.getByTestId('menu-play').click()
  await page.getByTestId('seat-addbot-1').click()            // the empty seat's "add a bot" zone
  if (opts.difficulty === 'passive') await page.getByTestId('seat-diff-1-passive').click()
  await page.getByTestId('lobby-ready').click()              // host ready → both ready → start
}

// Host path on the "Play" screen (web): the seat's invite zone reveals our room code.
export async function revealRoomCode(page: Page, slot = 1): Promise<string> {
  await page.getByTestId(`seat-invite-${slot}`).click()
  const text = await page.getByTestId(`seat-code-${slot}`).locator('.seat-code-text').innerText()
  return text.trim()
}

// Guest path (web): join someone's room by its code via the field below the seats.
export async function joinByCode(page: Page, code: string) {
  await page.getByTestId('join-code-field').fill(code)
  await page.getByTestId('join-code-go').click()
}

// Wait until R3F initializes and mounts Game, then skip the ready ritual
// (split-READY + 3s countdown) — gameplay tests need combat right away.
export async function waitForGame(page: Page, opts: NavigateOpts = {}) {
  await navigateThroughMenu(page, opts)
  await page.waitForFunction(() => !!(window as any).__debugCamera, { timeout: 10000 })
  await page.evaluate(() => (window as any).__debugForceLive?.())
  await page.waitForFunction(() => (window as any).__debugPhase?.() === 'live', { timeout: 5000 })
  // forceLive jumps over the ritual+countdown, during which in the real flow Rapier WASM has time to load.
  // Before the world is bound applyPhysics is a no-op (can't move) — wait for physics to be ready.
  await page.waitForFunction(() => (window as any).__debugPhysicsReady?.() === true, { timeout: 10000 })
}

export async function unlockPointer(page: Page, opts: NavigateOpts = {}) {
  await waitForGame(page, opts)
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true })
    document.dispatchEvent(new Event('pointerlockchange'))
  })
}

export async function getCameraPos(page: Page) {
  return page.evaluate(() => {
    const cam = (window as any).__debugCamera
    return { x: +cam.position.x.toFixed(3), y: +cam.position.y.toFixed(3), z: +cam.position.z.toFixed(3) }
  })
}

export async function holdKey(page: Page, code: string, ms: number) {
  await page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code)
  await page.waitForTimeout(ms)
  await page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), code)
}

export async function mouseDown(page: Page, button: number) {
  await page.evaluate((b) => window.dispatchEvent(new MouseEvent('mousedown', { button: b, bubbles: true })), button)
}

export async function aimAtBot(page: Page, botId = 0) {
  await page.evaluate((id) => {
    const cam = (window as any).__debugCamera
    const getPos = (window as any).__debugBotPos?.[id]
    if (!cam || !getPos) return
    const pos = getPos()
    if (pos) cam.lookAt(pos.x, pos.y + 0.5, pos.z)
  }, botId)
}
