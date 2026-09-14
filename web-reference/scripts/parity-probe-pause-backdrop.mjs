// Probe: is the match scene drawn under the pause menu and the match-end screen? Screenshots with the overlay shown and
// hidden, the elements stacked at a floor point, the overlay's computed style and the canvas style.
//   node scripts/parity-probe-pause-backdrop.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchReferencePage, enterLiveMatch, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/probes/web-pause-backdrop');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const FLOOR_POINT = { x: 300, y: 620 };
const SETTLE_MS = 400;

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const setLock = locked => page.evaluate(isLocked => {
  const canvas = document.querySelector('canvas');
  Object.defineProperty(document, 'pointerLockElement', { get: () => (isLocked ? canvas : null), configurable: true });
  document.dispatchEvent(new Event('pointerlockchange'));
}, locked);
const inspect = (selector, point) => page.evaluate(({ sel, p }) => {
  const overlay = sel ? document.querySelector(sel) : null;
  const canvas = document.querySelector('canvas');
  const style = el => { if (!el) return null; const s = getComputedStyle(el); return { background: s.backgroundColor,
    backdrop: s.backdropFilter, opacity: s.opacity, zIndex: s.zIndex, display: s.display, visibility: s.visibility }; };
  return { overlay: style(overlay), canvas: style(canvas), canvasSize: canvas ? [canvas.width, canvas.height] : null,
    hidden: document.hidden,
    stack: document.elementsFromPoint(p.x, p.y).map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`
      + ` bg=${getComputedStyle(e).backgroundColor} op=${getComputedStyle(e).opacity}`) };
}, { sel: selector, p: point });
const countFrames = () => page.evaluate(() => new Promise(done => {
  let frames = 0; const start = performance.now();
  const step = now => { frames++; if (now - start < 500) requestAnimationFrame(step); else done(frames); };
  requestAnimationFrame(step);
}));

try {
  const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile: PROFILE, botName: 'EX82R' });
  await shot('live');
  const live = await inspect(null, FLOOR_POINT);
  await page.mouse.move(0, 0);
  await setLock(false);
  await page.getByTestId('pause-resume').waitFor();
  await page.waitForTimeout(SETTLE_MS);
  await shot('pause');
  const pause = { ...await inspect('.screen', FLOOR_POINT), rafFramesIn500ms: await countFrames() };
  await page.evaluate(() => { document.querySelector('.screen').style.display = 'none'; });
  await page.waitForTimeout(SETTLE_MS);
  await shot('pause-overlay-hidden');
  await page.evaluate(() => { document.querySelector('.screen').style.display = ''; });
  await setLock(true);
  await page.evaluate(() => window.__debugForceEnd?.());
  await page.getByTestId('match-outcome').waitFor({ timeout: 10000 });
  await settleScene(page);
  await shot('match-end');
  const end = await inspect('[data-testid="match-outcome"]', FLOOR_POINT);
  await page.evaluate(() => { document.querySelector('[data-testid="match-outcome"]').parentElement.style.display = 'none'; });
  await page.waitForTimeout(SETTLE_MS);
  await shot('match-end-overlay-hidden');
  const facts = { renderer, live, pause, end, errors };
  await writeFile(resolve(output, 'probe.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts, null, 2));
} finally {
  await browser.close();
}
