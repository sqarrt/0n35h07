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
        `Start Chrome with: --remote-debugging-port=${CDP_PORT}`,
        { cause: e },
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

// Force the bc transport via URL (?net=bc) — the app no longer reads net from localStorage.
// Relative '/' navigations in tests get net=bc (unless explicitly set otherwise).
function withBcNet(url: string): string {
  if (/^https?:\/\//.test(url)) return url   // leave absolute URLs untouched
  const [path, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  if (!params.has('net')) params.set('net', 'bc')
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

// Custom fixtures: 'connected' project reuses a single CDP tab; otherwise — a deterministic e2e environment.
export const test = base.extend<{ page: Page }>({
  // Init script on the context → applies to both `page` and `context.newPage()` (multiplayer.spec):
  // a profile with post-processing disabled (the edge outline drops FPS in two-instance headless and breaks
  // timing-dependent checks; it isn't needed in e2e). The bc transport — via URL (see context.on('page')).
  context: async ({ context }, use, testInfo) => {
    if (testInfo.project.name !== 'connected') {
      await context.addInitScript(() => {
        try {
          localStorage.setItem('oneshot:profile', JSON.stringify({ name: 'Player', primaryColor: '#4af', reserveColor: '#fa4', postProcessing: false }))
        } catch { /* ignore */ }
      })
      // Every page of the context (the fixture `page` + context.newPage in multiplayer/killstreak/comeback)
      // navigates with ?net=bc — we wrap goto once here.
      context.on('page', (p) => {
        const origGoto = p.goto.bind(p)
        p.goto = ((url: string, opts?: Parameters<typeof origGoto>[1]) => origGoto(withBcNet(url), opts)) as typeof p.goto
      })
    }
    await use(context)
  },
  page: async ({ page }, use, testInfo) => {
    if (testInfo.project.name === 'connected') {
      const cdpPage = await getConnectedPage()
      await use(cdpPage)
      // Don't close — same tab is reused by the next test
    } else {
      await use(page)
    }
  },
})

export { expect }
