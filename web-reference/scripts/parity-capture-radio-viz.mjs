// The LIBRARY window's visualizer (components/RadioVisualizer) behind an empty explorer on the desktop build: the stub
// __TAURI_INTERNALS__ with an empty library, window.__debugVizPin holding one frame (bands, level, impulse, phase,
// frame, the field's seed) so every mode draws the same picture each run. The mini-player's name opens the Radio
// screen; the backdrop canvas is hidden, the visualizer's is not. A click on the status pill steps AUTO → SCOPE → BARS
// → RADIAL → FIELD; a frame per mode. Facts: the canvas box, buffer size and opacity, the pin.
// PARITY_FULLSCREEN=1 takes the same frames in the fullscreen window, suffixed -fs.
//   node scripts/parity-capture-radio-viz.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FULLSCREEN, FULLSCREEN_ON, VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';
import { APP_DATA, stubDesktop } from './parity-desktop-stub.mjs';

const SUFFIX = FULLSCREEN_ON ? '-fs' : '';
const WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };
const output = resolve(process.argv[2] ?? '../test-results/parity-radio-viz');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', radioEnabled: false };
const SETTLE_TIMEOUT_MS = 30000;
const EXPAND_SETTLE_MS = 1500;
const MODE_SETTLE_MS = 400;
const LIBRARY = [['radio', null]];
const MODES = ['scope', 'bars', 'radial', 'field'];   // the pill's order after AUTO
// A loud-bass, tapering spectrum: every mode has something to show.
const PIN = { phase: 1.7, frame: 0, level: 0.08, impulse: 0.35, seed: 7,
  bands: [0.82, 0.9, 0.76, 0.7, 0.62, 0.58, 0.5, 0.46, 0.52, 0.44, 0.4, 0.38, 0.35, 0.3, 0.28, 0.26, 0.3, 0.22, 0.2, 0.18,
    0.15, 0.12, 0.1, 0.08] };

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage(WINDOW);
const shot = name => page.screenshot({ path: resolve(output, `${name}${SUFFIX}.png`) });

try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.addInitScript(() => localStorage.setItem('radio.viz', 'auto'));
  await page.addInitScript(pin => { window.__debugVizPin = pin; }, PIN);
  await page.addInitScript(stubDesktop, { appData: APP_DATA, library: LIBRARY });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('radio-track-name').click();
  await page.getByTestId('radio-visualizer').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(EXPAND_SETTLE_MS);
  await page.evaluate(() => document.querySelectorAll('canvas:not([data-testid="radio-visualizer"])')
    .forEach(c => { c.style.visibility = 'hidden'; }));
  const facts = { viewport: WINDOW.viewport, deviceScaleFactor: WINDOW.deviceScaleFactor, profile: PROFILE, pin: PIN, modes: {} };
  facts.canvas = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="radio-visualizer"]');
    const r = c.getBoundingClientRect();
    return { box: [r.x, r.y, r.width, r.height], buffer: [c.width, c.height], opacity: getComputedStyle(c).opacity };
  });
  for (const mode of MODES) {
    await page.getByTestId('radio-viz-switch').click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(MODE_SETTLE_MS);
    await shot(`web-radio-viz-${mode}`);
    facts.modes[mode] = await page.getByTestId('radio-viz-switch').textContent();
  }
  facts.errors = errors;
  await writeFile(resolve(output, `web-radio-viz${SUFFIX}.json`), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ canvas: facts.canvas, modes: facts.modes, errors }, null, 1));
} finally {
  await browser.close();
}
