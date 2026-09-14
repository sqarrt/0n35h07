// Battle / War match frames: menu → PLAY with the parity identity (English) → the mode tile → passive bots named
// B1..B3 on the free seats → READY → countdown → live with a faked pointer lock. Saves the live frame plus the top bar
// boxes (.match-hud, .mhud-team panes, .mhud-row rows, .mhud-total, .timer) and computed styles as JSON per mode.
//   node scripts/parity-capture-teams.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-teams');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const MODES = (process.env.PARITY_MODES ?? '2v2,ffa').split(',');
const BOT_SLOTS = [1, 2, 3];
const SETTLE_TIMEOUT_MS = 30000;

const measure = page => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, letterSpacing: s.letterSpacing, color: s.color, background: s.backgroundColor,
      padding: s.padding, textShadow: s.textShadow, textDecoration: s.textDecorationLine };
  };
  const all = selector => [...document.querySelectorAll(selector)].map(el => ({
    box: box(el), text: el.textContent, testid: el.dataset.testid ?? null, style: style(el) }));
  return { hud: all('.match-hud'), panes: all('.match-hud .mhud-team'), rows: all('.match-hud .mhud-row'),
    totals: all('.match-hud .mhud-total'), timer: all('.match-hud .timer'), frags: all('.match-hud .mhud-row .frag') };
});

async function captureMode(mode) {
  const { browser, page, errors } = await launchReferencePage();
  try {
    await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
    await settleScene(page);
    await page.getByTestId('menu-play').click();
    await page.getByTestId(`lobby-map-${mapId}`).click();
    await page.getByTestId(`mode-tile-${mode}`).click();
    for (const slot of BOT_SLOTS) {
      await page.getByTestId(`seat-addbot-${slot}`).click();
      await page.getByTestId(`seat-diff-${slot}-passive`).click();
      await page.getByTestId(`lobby-bot-name-${slot}`).fill(`B${slot}`);
    }
    await page.getByTestId('lobby-ready').click();
    await page.waitForFunction(() => !!window.__debugCamera, null, { timeout: SETTLE_TIMEOUT_MS });
    await page.evaluate(() => window.__debugReady?.());
    await page.waitForFunction(() => window.__debugPhysicsReady?.() && window.__debugPhase?.() === 'live', null,
      { timeout: SETTLE_TIMEOUT_MS });
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
      document.dispatchEvent(new Event('pointerlockchange'));
    });
    await settleScene(page);
    await page.screenshot({ path: resolve(output, `web-match-${mode}.png`) });
    return { mode, mapId, ...await measure(page), errors };
  } finally {
    await browser.close();
  }
}

await mkdir(output, { recursive: true });
const facts = { viewport: VIEWPORT, profile: PROFILE, modes: {} };
for (const mode of MODES) facts.modes[mode] = await captureMode(mode);
await writeFile(resolve(output, 'web-teams.json'), JSON.stringify(facts, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(facts.modes).map(([m, f]) =>
  [m, { hud: f.hud.map(h => h.box), panes: f.panes.map(p => p.box), totals: f.totals.map(t => [t.text, t.box]), errors: f.errors }]))));
