// Probe: does Chrome draw text heavier inside a backdrop-filter subtree (the invite toast, the friend picker)? Over an
// opaque #0a0c11 cover the same runs are drawn plainly, under an ancestor with backdrop-filter: blur(2px), inside the
// glass card style and in a translateZ(0) layer. Saves the frame and every run's box for an ink comparison.
//   node scripts/parity-probe-backdrop-text.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchReferencePage } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/probes/web-backdrop-text');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const SETTLE_TIMEOUT_MS = 30000;
const FONT_SETTLE_MS = 800;
const VARIANTS = {
  plain: '',
  backdrop: 'backdrop-filter: blur(2px);',
  glass: 'background: rgba(10, 15, 20, 0.55); backdrop-filter: blur(24px) saturate(160%); border-radius: 14px;',
  layer: 'transform: translateZ(0);',
};
const RUNS = [
  { key: 'name14', text: 'alice Bob invites', css: 'font-size: 14px; letter-spacing: 0.04em; color: #cfe6ff;' },
  { key: 'title12', text: 'invites you to a game', css: 'font-size: 12.5px; letter-spacing: 0.04em; color: #cfe6ff;' },
  { key: 'chip11', text: 'INVITE ACCEPT', css: 'font-size: 11px; letter-spacing: 0.14em; color: #7fd0ff;' },
  { key: 'ttl13', text: 'CHOOSE A FRIEND', css: 'font-size: 13px; letter-spacing: 0.18em; color: #7fd0ff;' },
];

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  const boxes = await page.evaluate(({ variants, runs }) => {
    const cover = document.createElement('div');
    cover.style.cssText = 'position: fixed; inset: 0; z-index: 100000; background: #0a0c11;';
    document.body.appendChild(cover);
    const out = [];
    Object.entries(variants).forEach(([variant, style], column) => {
      runs.forEach((run, row) => {
        const holder = document.createElement('div');
        holder.style.cssText = `position: absolute; left: ${20 + column * 310}px; top: ${40 + row * 70}px; padding: 12px; ${style}`;
        const span = document.createElement('span');
        span.style.cssText = `font-family: var(--ui-font); white-space: nowrap; ${run.css}`;
        span.textContent = run.text;
        holder.appendChild(span);
        cover.appendChild(holder);
        out.push({ variant, run: run.key, span });
      });
    });
    return out.map(({ variant, run, span }) => { const r = span.getBoundingClientRect(); return { variant, run, box: [r.x, r.y, r.width, r.height] }; });
  }, { variants: VARIANTS, runs: RUNS });
  await page.waitForTimeout(FONT_SETTLE_MS);
  await page.screenshot({ path: resolve(output, 'web-backdrop-text.png') });
  await writeFile(resolve(output, 'web-backdrop-text.json'), JSON.stringify({ variants: VARIANTS, runs: RUNS, boxes, errors }, null, 2));
  console.log(JSON.stringify({ boxes: boxes.length, errors }));
} finally {
  await browser.close();
}
