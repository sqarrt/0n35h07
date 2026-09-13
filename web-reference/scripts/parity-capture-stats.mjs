// StatsOverlay frames: a live match with the parity identity (PARITY7 #fa4) and both debug flags on, where
// __debugStats freezes the readings (FPS, the worst frame, the 150 frame times, the speed) so the text and the graph are
// comparable. Saves a screenshot plus the text / graph boxes (getBoundingClientRect) and the stats as JSON.
//   node scripts/parity-capture-stats.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-stats');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const HISTORY = 150;
const BASE_FRAME_MS = 6.9;            // a steady ~144 FPS with two spikes, so the guides and the peaks both show
const SPIKES = { 40: 22.0, 100: 12.0 };
const SETTLE_MS = 700;
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', showFps: true, showSpeed: true };
const stats = {
  fps: 144,
  worstMs: 9.7,
  frameTimes: Array.from({ length: HISTORY }, (_, i) => SPIKES[i] ?? BASE_FRAME_MS),
  speed: 7.4,
};
const EXPECTED_FPS_TEXT = '144 FPS · MIN 103 (9.7 ms)';

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
try {
  const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile: PROFILE, botName: 'EX82R' });
  await page.evaluate(value => { window.__debugStats = value; }, stats);
  await page.waitForTimeout(SETTLE_MS);
  const boxes = await page.evaluate(() => {
    const canvas = document.querySelector('canvas[style*="150px"]');
    if (!canvas) return null;
    const wrap = canvas.parentElement;
    const rect = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    const [fpsLine, , speedLine] = wrap.children;
    return { fpsText: fpsLine.textContent, speedText: speedLine?.textContent ?? null, wrap: rect(wrap),
      fps: rect(fpsLine), graph: rect(canvas), speed: speedLine ? rect(speedLine) : null };
  });
  if (!boxes) throw new Error('StatsOverlay graph not found');
  if (boxes.fpsText !== EXPECTED_FPS_TEXT) throw new Error(`__debugStats hook missing (got "${boxes.fpsText}"): restart the Vite dev server`);
  await page.screenshot({ path: resolve(output, 'web-stats.png') });
  await writeFile(resolve(output, 'web-stats.json'), JSON.stringify({ stats, ...boxes }, null, 2));
  console.log(JSON.stringify({ renderer, errors, ...boxes }));
} finally {
  await browser.close();
}
