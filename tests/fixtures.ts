import { test as base, expect, Page, Browser, BrowserContext, chromium } from '@playwright/test'

const CDP_PORT = process.env.CDP_PORT ?? '9222'

// Singleton — one tab reused across all connected-mode tests (requires --workers=1)
let _browser: Browser | null = null
let _ctx: BrowserContext | null = null
let _page: Page | null = null

async function getConnectedPage(): Promise<Page> {
  if (!_browser) {
    try {
      _browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`)
    } catch (e) {
      throw new Error(
        `Cannot connect to browser at localhost:${CDP_PORT}. ` +
        `Start Chrome with: --remote-debugging-port=${CDP_PORT}\n${e}`
      )
    }
  }
  if (!_ctx) {
    _ctx = await _browser.newContext({ baseURL: 'http://localhost:5173' })
  }
  if (!_page || _page.isClosed()) {
    _page = await _ctx.newPage()
  }
  return _page
}

// Custom `page` fixture: in 'connected' project reuses a single tab via CDP
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use, testInfo) => {
    if (testInfo.project.name === 'connected') {
      const cdpPage = await getConnectedPage()
      await use(cdpPage)
      // Don't close — same tab is reused by the next test
    } else {
      // e2e всегда на BroadcastChannel (без внешних трекеров Trystero). Применяется и к
      // страницам, созданным через context.newPage() (multiplayer.spec).
      await page.context().addInitScript(() => {
        try { localStorage.setItem('oneshot:net', 'bc') } catch { /* ignore */ }
      })
      await use(page)
    }
  },
})

export { expect }
