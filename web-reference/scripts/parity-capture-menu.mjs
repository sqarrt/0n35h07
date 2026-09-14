// Main-menu layout frames: the English menu with the parity identity, once over the 3D backdrop and once with the
// backdrop's canvases hidden (the panel, logo, rule, buttons, hint and version chip alone), PLAY hovered too. Saves the
// screenshots plus the element boxes and computed styles as JSON.
//   node scripts/parity-capture-menu.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-menu');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const SETTLE_TIMEOUT_MS = 30000;
const STATE_SETTLE_MS = 300;
const BUTTON_IDS = ['menu-play', 'menu-appearance', 'menu-settings', 'menu-about', 'menu-radio', 'menu-exit'];

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const measure = () => page.evaluate(ids => {
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight,
      margin: s.margin, padding: s.padding, color: s.color, background: s.backgroundColor, border: s.border,
      textShadow: s.textShadow, backdropFilter: s.backdropFilter, width: s.width };
  };
  const entry = el => (el ? { box: box(el), text: el.textContent, style: style(el) } : null);
  const out = { panel: entry(document.querySelector('.menu-panel')), logo: entry(document.querySelector('.menu-panel h1')),
    rule: entry(document.querySelector('.accent-rule')), hint: entry(document.querySelector('.menu-hint')),
    version: entry(document.querySelector('.version-chip')), buttons: {} };
  for (const id of ids) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el) out.buttons[id] = entry(el);
  }
  return out;
}, BUTTON_IDS);

try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.mouse.move(0, 0);
  await shot('web-menu-backdrop');
  await page.evaluate(() => document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; }));
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-menu');
  const menu = await measure();
  await page.getByTestId('menu-play').hover();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-menu-hover-play');
  await page.getByTestId('menu-appearance').hover();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-menu-hover-secondary');
  const facts = { viewport: VIEWPORT, profile: PROFILE, menu, canvases: await page.evaluate(() => document.querySelectorAll('canvas').length), errors };
  await writeFile(resolve(output, 'web-menu.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts));
} finally {
  await browser.close();
}
