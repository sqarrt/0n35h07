// OVERHEAT frames (OV): the parity identity (PARITY7 #fa4) on a real double / triple / singularity streak set by
// __debugSetStreak (OVERHEAT mods, pierce and see-through blocks follow on the next tick, the HUD tier at once).
// Bolts are random and strike rarely, so every ov-strike animation is paused at 4% (full opacity) and ov-pulse at 0%
// (opacity 0.8); the bolts' side, position, width and SVG segments are exported next to each frame so the Godot
// fixture can draw the very same bolts.
//   node scripts/parity-capture-overheat.mjs <output dir> [base url]      (PARITY_MAP, PARITY_TIERS=singularity,...)
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-overheat');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const ALL_TIERS = { double: 2, triple: 3, singularity: 5 };
const wanted = process.env.PARITY_TIERS?.split(',');
const TIERS = Object.fromEntries(Object.entries(ALL_TIERS).filter(([tier]) => !wanted || wanted.includes(tier)));
const HUMAN_ID = 0;
const MOUNT_MS = 300;                 // React mounts the vignette and its bolts; the blocks turn see-through
const STRIKE_PEAK = 0.04;             // ov-strike keyframe with opacity 1
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };

await mkdir(output, { recursive: true });
const facts = { mapId, viewport: VIEWPORT, strikePeak: STRIKE_PEAK, runs: {} };
for (const [tier, streak] of Object.entries(TIERS)) {
  const { browser, page, errors } = await launchReferencePage();
  try {
    const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile: PROFILE, botName: 'EX82R' });
    if (!(await page.evaluate(() => typeof window.__debugSetStreak === 'function'))) {
      throw new Error('__debugSetStreak hook missing: restart the Vite dev server');
    }
    await page.evaluate(([id, n]) => window.__debugSetStreak(id, n), [HUMAN_ID, streak]);
    await page.waitForTimeout(MOUNT_MS);
    const bolts = await page.evaluate(peak => {
      for (const animation of document.getAnimations()) {
        const name = animation.animationName;
        if (name !== 'ov-strike' && name !== 'ov-pulse') continue;
        animation.pause();
        const timing = animation.effect.getTiming();
        animation.currentTime = name === 'ov-strike' ? timing.delay + timing.duration * peak : 0;
      }
      return [...document.querySelectorAll('.ov-bolt')].map(bolt => {
        const svg = bolt.querySelector('svg');
        return {
          side: bolt.style.left !== '' ? 'l' : 'r',
          topPct: parseFloat(bolt.style.top),
          length: Number(svg.getAttribute('width')),
          segments: [...svg.querySelectorAll('path')].map(path => {
            const [x0, y0, x1, y1] = path.getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number);
            return { from: [x0, y0], to: [x1, y1], width: Number(path.getAttribute('stroke-width')) };
          }),
        };
      });
    }, STRIKE_PEAK);
    await page.waitForTimeout(100);   // let the paused state paint
    await page.screenshot({ path: resolve(output, `web-overheat-${tier}.png`) });
    await writeFile(resolve(output, `web-overheat-${tier}.json`), JSON.stringify({ tier, bolts }, null, 2));
    facts.runs[tier] = { renderer, errors, bolts: bolts.length };
  } finally {
    await browser.close();
  }
}
await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts));
