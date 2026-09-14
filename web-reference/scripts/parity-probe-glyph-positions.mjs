// Probe: how Chrome places the glyphs of a letter-spaced run in the UI font — whole-pixel pen positions or subpixel
// ones. Runs of one repeated glyph ("0") at the sizes the UI uses, light on the page background, each in its own row;
// the frame shows whether every copy of the glyph has the same pixels (whole-pixel snapping) or shifts in steps
// (subpixel positioning), and the boxes give Chrome's exact run widths.
//   node scripts/parity-probe-glyph-positions.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchReferencePage } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/probes/web-glyph-positions');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const SETTLE_TIMEOUT_MS = 30000;
const FONT_SETTLE_MS = 800;
const RUN = '0'.repeat(24);
const ROWS = [
  { key: 'toast', px: 12.5, em: 0.04 },
  { key: 'button', px: 16, em: 0.18 },
  { key: 'field', px: 11.2, em: 0.15 },
  { key: 'subheader', px: 13.6, em: 0.18 },
  { key: 'title', px: 24, em: 0.2 },
];
const LEFT = 20;
const TOP = 20;
const ROW_GAP = 40;

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  const boxes = await page.evaluate(({ rows, run, left, top, gap }) => {
    const cover = document.createElement('div');
    cover.style.cssText = 'position: fixed; inset: 0; z-index: 100000; background: #0a0c11;';
    document.body.appendChild(cover);
    return rows.map((row, i) => {
      const span = document.createElement('span');
      span.style.cssText = `position: absolute; left: ${left}px; top: ${top + i * gap}px; white-space: nowrap;
        font-family: var(--ui-font); font-size: ${row.px}px; letter-spacing: ${row.em}em; color: #ffffff; line-height: 1;`;
      span.textContent = run;
      cover.appendChild(span);
      const r = span.getBoundingClientRect();
      return { ...row, box: [r.x, r.y, r.width, r.height] };
    });
  }, { rows: ROWS, run: RUN, left: LEFT, top: TOP, gap: ROW_GAP });
  await page.waitForTimeout(FONT_SETTLE_MS);
  await page.screenshot({ path: resolve(output, 'web-glyph-positions.png') });
  await writeFile(resolve(output, 'web-glyph-positions.json'), JSON.stringify({ run: RUN, boxes, errors }, null, 2));
  console.log(JSON.stringify({ boxes: boxes.map(b => [b.key, b.box[2]]), errors }));
} finally {
  await browser.close();
}
