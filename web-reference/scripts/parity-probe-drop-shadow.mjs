// Probe: how Chrome sizes `filter: drop-shadow(0 0 <N>px)` (the OVERHEAT bolt glow). Wide opaque white bars on black
// with a pure red drop-shadow; the red falloff outside each bar's edge gives the Gaussian sigma for each N.
//   node scripts/parity-probe-drop-shadow.mjs <output dir>
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchReferencePage, glRenderer } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/probes/drop-shadow');
const BLURS_PX = [2, 5];
const BAR = { width: 200, height: 120, left: 400, top: 100, gap: 200 };
await mkdir(output, { recursive: true });
const { browser, page } = await launchReferencePage();
try {
  const renderer = await glRenderer(page);
  const bars = BLURS_PX.map((blur, i) => `<div style="position:absolute;left:${BAR.left}px;` +
    `top:${BAR.top + i * (BAR.height + BAR.gap)}px;width:${BAR.width}px;height:${BAR.height}px;background:#fff;` +
    `filter:drop-shadow(0 0 ${blur}px #f00)"></div>`).join('');
  await page.setContent(`<html><body style="margin:0;background:#000">${bars}</body></html>`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(output, 'web-drop-shadow.png') });
  const facts = { renderer, blursPx: BLURS_PX, bar: BAR };
  await writeFile(resolve(output, 'facts.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts));
} finally {
  await browser.close();
}
