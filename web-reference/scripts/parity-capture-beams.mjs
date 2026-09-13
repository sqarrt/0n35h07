// Beam skin frames (G11b): for each windup style the parity identity (PARITY7 #fa4) fires in third person at the
// passive bot; the simulation clock is slowed (__debugTimeScale) so the 200 ms beam is captured 50 ms after the shot.
//   node scripts/parity-capture-beams.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-beams');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const STYLES = ['classic', 'rage', 'singularity'];
const TIME_SCALE = 0.05;              // 1 sim second takes 20 real seconds
const WINDUP_MS = 400;
const SHOT_OFFSET_MS = 50;            // beam life share 0.25
const SIM_MARGIN_MS = 10;
await mkdir(output, { recursive: true });
const facts = { mapId, viewport: VIEWPORT, timeScale: TIME_SCALE, shotOffsetMs: SHOT_OFFSET_MS, runs: {} };
for (const style of STYLES) {
  const { browser, page, errors } = await launchReferencePage();
  try {
    const profile = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', windupStyle: style };
    const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile, botName: 'EX82R' });
    await page.keyboard.press('KeyV');
    await settleScene(page);
    // A stale dev server (no file watching on some mounts) would lack the hook: fail instead of capturing real time.
    if (!(await page.evaluate(() => typeof window.__debugTimeScale === 'function'))) {
      throw new Error('__debugTimeScale hook missing: restart the Vite dev server');
    }
    await page.evaluate(k => window.__debugTimeScale(k), TIME_SCALE);
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })));
    // Wait for the shot in sim time (windup), then the offset into the beam life.
    await page.waitForTimeout((WINDUP_MS + SHOT_OFFSET_MS - SIM_MARGIN_MS) / TIME_SCALE);
    await page.screenshot({ path: resolve(output, `web-beam-${style}.png`) });
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));
    facts.runs[style] = { renderer, errors };
  } finally {
    await browser.close();
  }
}
await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts));
