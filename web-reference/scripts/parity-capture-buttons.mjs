// UI theme frames: the themed buttons on the pause menu (RESUME primary with its pointer-lock cooldown fill, ghost
// SETTINGS / TO MENU) and on the match-end screen (EXIT primary), idle and hovered. The pause opens by dropping the
// faked pointer lock; __debugLockCooldownLeft freezes the RESUME cooldown. Saves screenshots plus the element boxes and
// computed button styles as JSON.
//   node scripts/parity-capture-buttons.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-buttons');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const BOT_NAME = 'EX82R';
const POINTERLOCK_COOLDOWN_MS = 1300;   // web constants.ts
const COOLDOWN_LEFT_MS = POINTERLOCK_COOLDOWN_MS / 2;
const STATE_SETTLE_MS = 350;            // App re-renders the pause every 100 ms
const PAUSE_IDS = ['pause-resume', 'pause-settings', 'pause-to-menu'];
const END_IDS = ['match-outcome', 'match-ranking', 'match-reason', 'match-exit'];

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const setLock = locked => page.evaluate(isLocked => {
  const canvas = document.querySelector('canvas');
  Object.defineProperty(document, 'pointerLockElement', { get: () => (isLocked ? canvas : null), configurable: true });
  document.dispatchEvent(new Event('pointerlockchange'));
}, locked);
const measure = ids => page.evaluate(testIds => {
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight,
      padding: s.padding, margin: s.margin, border: s.border, background: s.backgroundColor, color: s.color,
      opacity: s.opacity, boxSizing: s.boxSizing };
  };
  const out = {};
  for (const id of testIds) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) continue;
    out[id] = { box: box(el), text: el.textContent, style: style(el) };
    const fill = el.querySelector('span[style*="position: absolute"]');
    if (fill) out[id].fill = box(fill);
  }
  const title = document.querySelector('.screen h2');
  if (title) out.title = { box: box(title), text: title.textContent, style: style(title) };
  return out;
}, ids);
const hover = async (id, name) => {
  await page.getByTestId(id).hover();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot(name);
  const facts = await measure([id]);
  await page.mouse.move(0, 0);
  return facts[id];
};

try {
  const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile: PROFILE, botName: BOT_NAME });
  await page.evaluate(ms => { window.__debugLockCooldownLeft = ms; }, COOLDOWN_LEFT_MS);
  await page.mouse.move(0, 0);
  await setLock(false);
  await page.getByTestId('pause-resume').waitFor();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-pause-cooldown');
  const pauseCooldown = await measure(PAUSE_IDS);
  await page.evaluate(() => { window.__debugLockCooldownLeft = 0; });
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-pause');
  const pause = await measure(PAUSE_IDS);
  const pauseHoverGhost = await hover('pause-to-menu', 'web-pause-hover-ghost');
  const pauseHoverPrimary = await hover('pause-resume', 'web-pause-hover-primary');

  await page.evaluate(() => { delete window.__debugLockCooldownLeft; });
  await setLock(true);
  await page.evaluate(() => window.__debugForceEnd?.());
  await page.getByTestId('match-outcome').waitFor({ timeout: 10000 });
  await settleScene(page);
  await shot('web-match-end');
  const matchEnd = await measure(END_IDS);
  const matchEndHover = await hover('match-exit', 'web-match-end-hover');

  const facts = { mapId, renderer, viewport: VIEWPORT, profile: PROFILE, botName: BOT_NAME,
    cooldownLeftMs: COOLDOWN_LEFT_MS, cooldownMs: POINTERLOCK_COOLDOWN_MS,
    pauseCooldown, pause, pauseHoverGhost, pauseHoverPrimary, matchEnd, matchEndHover, errors };
  await writeFile(resolve(output, 'web-buttons.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts));
} finally {
  await browser.close();
}
