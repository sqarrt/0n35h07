import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] ?? '../test-results/parity-corrected');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = 'os_arena';
const settleFrames = 180;
const settleMs = 5000;
// SwiftShader (the default software GL of headless Chromium) drops screen-space-steep GL_LINES, so the 1×1
// floor grid renders as horizontal stripes only. Route WebGL to a real driver: the GPU through D3D11 on Windows
// (the reference — what players see), ANGLE on desktop GL elsewhere; refuse to capture on SwiftShader.
const ANGLE_BACKEND = process.platform === 'win32' ? 'd3d11' : 'gl';
const GL_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu', `--use-angle=${ANGLE_BACKEND}`];
const FORBIDDEN_RENDERER = /SwiftShader/i;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: GL_ARGS,
  // Optional override when the installed Playwright browser build differs from the package's expected one.
  ...(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function glRenderer() {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return gl ? gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'no-webgl2';
  });
}
// The button can mount before Canvas warmup, model fade, glow compilation and camera damping.
// Wait for both real rendered frames and elapsed time; inspect the resulting captures as well.
async function settleScene() {
  await page.locator('canvas').first().waitFor({ state: 'visible' });
  await page.evaluate(async ({ frameCount, duration }) => {
    await document.fonts.ready;
    await new Promise((done, reject) => {
      let frames = 0;
      const start = performance.now();
      const timeout = setTimeout(() => reject(new Error('Scene did not settle in 60 seconds')), 60000);
      function step(now) {
        frames++;
        if (frames >= frameCount && now - start >= duration) {
          clearTimeout(timeout);
          done();
        } else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { frameCount: settleFrames, duration: settleMs });
}
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const renderer = await glRenderer();
  if (FORBIDDEN_RENDERER.test(renderer)) throw new Error(`Refusing to capture with a line-dropping renderer: ${renderer}`);
  await page.getByTestId('menu-play').waitFor({ timeout: 60000 });
  await settleScene();
  await page.screenshot({ path: resolve(output, 'web-menu.png') });
  await settleScene();
  await page.screenshot({ path: resolve(output, 'web-menu-later.png') });
  await page.getByTestId('menu-play').click();
  await page.getByTestId('seat-addbot-1').waitFor();
  await page.getByTestId(`lobby-map-${mapId}`).click();
  const selectedMaps = await page.locator('[data-testid^="lobby-map-os_"][aria-pressed="true"]').getAttribute('data-testid');
  if (selectedMaps !== `lobby-map-${mapId}`) throw new Error('Unexpected map selection');
  await settleScene();
  await page.screenshot({ path: resolve(output, 'web-lobby.png') });
  await writeFile(resolve(output, 'web-lobby.txt'), await page.locator('body').innerText());
  await page.getByTestId('seat-addbot-1').click();
  await page.getByTestId('seat-diff-1-passive').click();
  await settleScene();
  await page.screenshot({ path: resolve(output, 'web-lobby-with-bot.png') });
  await page.getByTestId('lobby-ready').click();
  await page.waitForFunction(() => !!window.__debugCamera, { timeout: 30000 });
  await page.evaluate(() => window.__debugReady?.());
  await page.waitForFunction(() => window.__debugPhysicsReady?.() && window.__debugPhase?.() === 'live');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await settleScene();
  await page.screenshot({ path: resolve(output, 'web-game.png') });
  const before = await page.evaluate(() => window.__debugTargetHitCount ?? 0);
  await page.evaluate(() => {
    const target = window.__debugBotPos?.[0]?.();
    if (!target) throw new Error('No bot position available');
    window.__debugCamera.lookAt(target.x, target.y + 0.5, target.z);
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
  });
  await page.waitForFunction(count => (window.__debugTargetHitCount ?? 0) > count, before, { timeout: 10000 });
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));
  const facts = await page.evaluate(() => ({
    phase: window.__debugPhase?.(),
    score: window.__debugScore?.(0),
    hits: window.__debugTargetHitCount,
    position: window.__debugPlayerPos?.(0),
  }));
  await page.screenshot({ path: resolve(output, 'web-hit.png') });
  await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify({ mapId, renderer, viewport: { width: 1280, height: 720 }, settleFrames, settleMs, facts, errors }, null, 2));
  console.log(JSON.stringify({ output, facts, errors }));
} finally {
  await browser.close();
}
