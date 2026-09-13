// Shield and dash trail skin frames (G11c): three runs pairing the shield and dash styles (dome + streak, hex + wave,
// crystal + rift) on the parity identity in third person. The simulation clock is slowed (__debugTimeScale) so the
// frames land 100 ms into the shield and 60 ms into the dash.
//   node scripts/parity-capture-shield-dash.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-shield-dash');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const RUNS = [
  { shieldStyle: 'dome', dashStyle: 'streak' },
  { shieldStyle: 'hex', dashStyle: 'wave' },
  { shieldStyle: 'crystal', dashStyle: 'rift' },
];
const TIME_SCALE = 0.05;
const SHIELD_FRAME_MS = 100;
const DASH_FRAME_MS = 60;
const RECOVER_MS = 3000;              // real time at normal speed: the shield ends before the dash
const RIGHT_BUTTON = 2;
await mkdir(output, { recursive: true });
const facts = { mapId, viewport: VIEWPORT, timeScale: TIME_SCALE, shieldFrameMs: SHIELD_FRAME_MS,
  dashFrameMs: DASH_FRAME_MS, runs: [] };
for (const run of RUNS) {
  const { browser, page, errors } = await launchReferencePage();
  try {
    const profile = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', ...run };
    const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile, botName: 'EX82R' });
    await page.keyboard.press('KeyV');
    await settleScene(page);
    if (!(await page.evaluate(() => typeof window.__debugTimeScale === 'function'))) {
      throw new Error('__debugTimeScale hook missing: restart the Vite dev server');
    }
    const scale = k => page.evaluate(v => window.__debugTimeScale(v), k);
    await scale(TIME_SCALE);
    await page.evaluate(b => window.dispatchEvent(new MouseEvent('mousedown', { button: b, bubbles: true })), RIGHT_BUTTON);
    await page.waitForTimeout(SHIELD_FRAME_MS / TIME_SCALE);
    await page.screenshot({ path: resolve(output, `web-shield-${run.shieldStyle}.png`) });
    await page.evaluate(b => window.dispatchEvent(new MouseEvent('mouseup', { button: b, bubbles: true })), RIGHT_BUTTON);
    await scale(1);
    await page.waitForTimeout(RECOVER_MS);
    await page.keyboard.down('KeyW');
    await scale(TIME_SCALE);
    await page.keyboard.press('ShiftLeft');
    await page.waitForTimeout(DASH_FRAME_MS / TIME_SCALE);
    await page.screenshot({ path: resolve(output, `web-dash-${run.dashStyle}.png`) });
    await page.keyboard.up('KeyW');
    await scale(1);
    facts.runs.push({ ...run, renderer, errors });
  } finally {
    await browser.close();
  }
}
await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts));
