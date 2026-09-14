// Photosensitivity warning frames as the desktop build (a stub __TAURI_INTERNALS__; no ?net=bc, which skips the
// warning). Frames: `web-warning-early` (600 ms in: content faded in, no hint yet), `web-warning` (the hint shown) and
// `web-warning-peak` (the same with the planet's breathing at its brightest). The planet pulse (warn-bg-pulse) is paused
// at a fixed time for every frame, so Godot pins the same phase. Saves the boxes, computed styles and the text's line
// boxes as JSON.
//   [PARITY_LOCALE=<id>] node scripts/parity-capture-warning.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-warning');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: process.env.PARITY_LOCALE ?? 'en' };
const EARLY_MS = 600;            // content-in (320 ms) is over, the hint (1500 ms) is not
const HINT_SETTLE_MS = 600;      // the hint's 240 ms opacity transition is over
const PULSE_MS = 1000;           // the planet pulse's phase in the base frames
const PULSE_PEAK_MS = 2000;      // 50% of the 4 s cycle: opacity 0.24
const SETTLE_TIMEOUT_MS = 30000;
const SELECTORS = ['.warn-screen', '.warn-planet', '.warn-content', '.warn-box', '.warn-head', '.warn-icon', '.warn-text',
  '.warn-hint', '.warn-chip', '.warn-hint > span:last-child'];

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const pinPulse = ms => page.evaluate(time => {
  for (const animation of document.getAnimations()) {
    if (animation.animationName === 'warn-bg-pulse') { animation.pause(); animation.currentTime = time; }
  }
}, ms);
const measure = () => page.evaluate(selectors => {
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight, color: s.color,
      opacity: s.opacity, padding: s.padding, border: s.border, borderRadius: s.borderRadius, background: s.backgroundColor,
      boxShadow: s.boxShadow, textShadow: s.textShadow, filter: s.filter };
  };
  const out = {};
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) out[selector] = { box: box(el), text: el.textContent, style: style(el) };
  }
  const text = document.querySelector('.warn-text');
  if (text) {
    const range = document.createRange();
    range.selectNodeContents(text);
    out.textLines = [...range.getClientRects()].map(r => [r.x, r.y, r.width, r.height]);
  }
  return out;
}, SELECTORS);

try {
  await page.addInitScript(p => {
    localStorage.setItem('oneshot:profile', JSON.stringify(p));
    window.__TAURI_INTERNALS__ = { invoke: () => new Promise(() => {}), transformCallback: () => 0,
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } } };
  }, PROFILE);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.warn-screen').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(EARLY_MS);
  await pinPulse(PULSE_MS);
  await shot('web-warning-early');
  const facts = { viewport: VIEWPORT, profile: PROFILE, pulseMs: PULSE_MS, peakMs: PULSE_PEAK_MS, early: await measure() };
  await page.locator('.warn-screen--ready').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await page.waitForTimeout(HINT_SETTLE_MS);
  await pinPulse(PULSE_MS);
  await shot('web-warning');
  facts.ready = await measure();
  await pinPulse(PULSE_PEAK_MS);
  await shot('web-warning-peak');
  facts.peak = await measure();
  facts.errors = errors;
  await writeFile(resolve(output, 'web-warning.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ errors, lines: facts.ready.textLines?.length }));
} finally {
  await browser.close();
}
