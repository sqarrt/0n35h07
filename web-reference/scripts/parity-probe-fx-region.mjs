// Probe: where Chrome clips the SVG turbulence filter of streak text. Captures names and banners at each tier together
// with the element boxes (getBoundingClientRect), so the glow extent can be measured against the box.
//   node scripts/parity-probe-fx-region.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchReferencePage, enterLiveMatch } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/probes/fx-region');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const CASES = [
  { id: 'double', streak: 2, announce: 'double' },
  { id: 'singularity', streak: 5, announce: 'singularity' },
];
const SETTLE_MS = 600;
const BANNER_GONE_MS = 2300;
await mkdir(output, { recursive: true });
const { browser, page } = await launchReferencePage();
const boxes = () => page.evaluate(() => {
  const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  return {
    name: rect(document.querySelector('[data-testid="hud-name-you"]')),
    banner: rect(document.querySelector('[data-testid="streak-banner"] .fx')),
  };
});
try {
  await enterLiveMatch(page, base, 'os_arena', async () => {}, { profile: PROFILE, botName: 'EX82R' });
  const facts = {};
  for (const c of CASES) {
    await page.evaluate(n => window.__debugStreak?.(0, n), c.streak);
    await page.evaluate(k => window.__debugAnnounce?.(k), c.announce);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: resolve(output, `web-${c.id}.png`) });
    facts[c.id] = await boxes();
    await page.waitForTimeout(BANNER_GONE_MS);
  }
  await writeFile(resolve(output, 'boxes.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts));
} finally {
  await browser.close();
}
