// AudioBar frames (audio parity): a live match with the parity identity (PARITY7 #fa4) where __debugAudioBands fixes
// the analysis spectrum, so the visualiser line holds a known shape once its attack / decay smoothing settles. Each run
// saves a screenshot plus the SVG polyline points and the SVG box (getBoundingClientRect) for exact geometry checks;
// the band values are exported so the Godot fixture feeds the same spectrum.
//   node scripts/parity-capture-audio-bar.mjs <output dir> [base url]
//   PARITY_AUDIO_BAR_FILTER=off also saves each run with the SVG drop-shadow filter removed (the line alone).
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-audio-bar');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const BANDS = 40;
const SETTLE_MS = 1500;               // attack 0.55 / decay 0.14 per frame settle well within this
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const BASS_LEVEL = 0.55;              // pattern: a strong bass hump falling toward the highs, a small mid bump
const HIGH_FLOOR = 0.04;
const MID_BAND = 22;
const MID_BUMP = 0.25;
const MID_WIDTH = 3;
const pattern = Array.from({ length: BANDS }, (_, i) => {
  const fall = BASS_LEVEL * (1 - i / BANDS) ** 2;
  const bump = MID_BUMP * Math.exp(-(((i - MID_BAND) / MID_WIDTH) ** 2));
  return Number((fall + bump + HIGH_FLOOR).toFixed(4));
});
const RUNS = { pattern, silence: Array(BANDS).fill(0) };
const LINE_ONLY = process.env.PARITY_AUDIO_BAR_FILTER === 'off';

await mkdir(output, { recursive: true });
const facts = { mapId, viewport: VIEWPORT, settleMs: SETTLE_MS, runs: {} };
for (const [run, bands] of Object.entries(RUNS)) {
  const { browser, page, errors } = await launchReferencePage();
  try {
    const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile: PROFILE, botName: 'EX82R' });
    await page.evaluate(values => { window.__debugAudioBands = values; }, bands);
    await page.waitForTimeout(SETTLE_MS);
    const line = await page.evaluate(() => {
      const polyline = document.querySelector('svg polyline[stroke="#4af"]');
      if (!polyline) return null;
      const box = polyline.ownerSVGElement.getBoundingClientRect();
      return { points: polyline.getAttribute('points').trim(), box: [box.x, box.y, box.width, box.height] };
    });
    if (!line) throw new Error('AudioBar polyline not found');
    const centerY = Number(line.points.split(/\s+/)[BANDS - 1].split(',')[1]);
    if (run === 'pattern' && !(centerY < 80)) throw new Error('__debugAudioBands hook missing: restart the Vite dev server');
    await page.screenshot({ path: resolve(output, `web-audio-bar-${run}.png`) });
    if (LINE_ONLY) {
      await page.evaluate(() => { document.querySelector('svg polyline[stroke="#4af"]').ownerSVGElement.style.filter = 'none'; });
      await page.waitForTimeout(100);
      await page.screenshot({ path: resolve(output, `web-audio-bar-${run}-line.png`) });
    }
    await writeFile(resolve(output, `web-audio-bar-${run}.json`), JSON.stringify({ run, bands, ...line }, null, 2));
    facts.runs[run] = { renderer, errors, centerY };
  } finally {
    await browser.close();
  }
}
await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts));
