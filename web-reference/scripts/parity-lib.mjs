// Shared steps of the parity capture scripts: a 1280×720 Chromium page on a real GL driver, scene settling and the
// menu → lobby (passive bot) → countdown → live match flow.
import { chromium } from 'playwright';

export const VIEWPORT = { width: 1280, height: 720 };
export const SETTLE_FRAMES = 180;
export const SETTLE_MS = 5000;
const SETTLE_TIMEOUT_MS = 60000;
// SwiftShader (the default software GL of headless Chromium) drops screen-space-steep GL_LINES, so the 1×1
// floor grid renders as horizontal stripes only. Route WebGL to a real driver: the GPU through D3D11 on Windows
// (the reference — what players see), ANGLE on desktop GL elsewhere; refuse to capture on SwiftShader.
const ANGLE_BACKEND = process.platform === 'win32' ? 'd3d11' : 'gl';
const GL_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu', `--use-angle=${ANGLE_BACKEND}`];
const FORBIDDEN_RENDERER = /SwiftShader/i;

/** The desktop window fullscreen on the parity machine's 3840×2160 display at the Windows 150% scale: the WebView's CSS
 *  viewport is the screen divided by the scale (2560×1440 CSS px) at a 1.5 pixel ratio. */
export const FULLSCREEN = { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1.5 };
/** PARITY_FULLSCREEN=1: every capture launches the FULLSCREEN window unless it passes its own viewport. */
export const FULLSCREEN_ON = process.env.PARITY_FULLSCREEN === '1';
const DEFAULT_WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };

/** Launch the browser and a page; throws when WebGL runs on a line-dropping renderer. */
/** `showScrollbars`: keep classic scrollbars (headless Chromium hides them by default; the desktop WebView draws its
 *  native thin 10 px bar, which takes layout width inside a scrolling panel). `viewport` / `deviceScaleFactor`: the
 *  page's CSS size and pixel ratio (FULLSCREEN for the fullscreen frames). */
export async function launchReferencePage({ showScrollbars = false, viewport = DEFAULT_WINDOW.viewport,
  deviceScaleFactor = DEFAULT_WINDOW.deviceScaleFactor, extraArgs = [] } = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: [...GL_ARGS, ...extraArgs],   // extraArgs: e.g. the radio capture's autoplay policy
    ...(showScrollbars ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {}),
    // Optional override when the installed Playwright browser build differs from the package's expected one.
    ...(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {}),
  });
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { browser, page, errors };
}

export async function glRenderer(page) {
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return gl ? gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'no-webgl2';
  });
  if (FORBIDDEN_RENDERER.test(renderer)) throw new Error(`Refusing to capture with a line-dropping renderer: ${renderer}`);
  return renderer;
}

// The button can mount before Canvas warmup, model fade, glow compilation and camera damping.
// Wait for both real rendered frames and elapsed time; inspect the resulting captures as well.
export async function settleScene(page) {
  await page.locator('canvas').first().waitFor({ state: 'visible' });
  await page.evaluate(async ({ frameCount, duration, timeoutMs }) => {
    await document.fonts.ready;
    await new Promise((done, reject) => {
      let frames = 0;
      const start = performance.now();
      const timeout = setTimeout(() => reject(new Error('Scene did not settle in time')), timeoutMs);
      function step(now) {
        frames++;
        if (frames >= frameCount && now - start >= duration) {
          clearTimeout(timeout);
          done();
        } else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { frameCount: SETTLE_FRAMES, duration: SETTLE_MS, timeoutMs: SETTLE_TIMEOUT_MS });
}

/**
 * Menu → lobby on `mapId` with a passive bot → READY → countdown → live with a faked pointer lock.
 * `onStage(stage)` runs at 'menu', 'lobby', 'lobby-with-bot', 'countdown' and 'live' (e.g. to take screenshots).
 */
export async function enterLiveMatch(page, base, mapId, onStage = async () => {}, { profile, botName } = {}) {
  const COUNTDOWN_FRAME_MS = 450;   // mid-way through the first number's 1 s cdPop animation
  // Optional fixed identity: the stored profile (web settings.ts key) is written before the app reads it.
  if (profile) await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), profile);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const renderer = await glRenderer(page);
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await onStage('menu');
  await page.getByTestId('menu-play').click();
  await page.getByTestId('seat-addbot-1').waitFor();
  await page.getByTestId(`lobby-map-${mapId}`).click();
  const selectedMaps = await page.locator('[data-testid^="lobby-map-os_"][aria-pressed="true"]').getAttribute('data-testid');
  if (selectedMaps !== `lobby-map-${mapId}`) throw new Error('Unexpected map selection');
  await settleScene(page);
  await onStage('lobby');
  await page.getByTestId('seat-addbot-1').click();
  await page.getByTestId('seat-diff-1-passive').click();
  if (botName) await page.getByTestId('lobby-bot-name-1').fill(botName);   // the host names the bot (setBotName)
  await settleScene(page);
  await onStage('lobby-with-bot');
  await page.getByTestId('lobby-ready').click();
  await page.waitForFunction(() => !!window.__debugCamera, { timeout: SETTLE_TIMEOUT_MS });
  await page.evaluate(() => window.__debugReady?.());
  await page.waitForFunction(() => window.__debugPhase?.() === 'countdown', null, { timeout: SETTLE_TIMEOUT_MS });
  await page.waitForTimeout(COUNTDOWN_FRAME_MS);
  await onStage('countdown');
  await page.waitForFunction(() => window.__debugPhysicsReady?.() && window.__debugPhase?.() === 'live');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await settleScene(page);
  await onStage('live');
  return renderer;
}
