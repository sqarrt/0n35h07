// In-match settings frames: menu → lobby with a passive bot → live match, the pointer lock dropped (the RESUME cooldown
// frozen at its end), then the pause menu, SETTINGS on SOUND and on GRAPHICS. The browser build: the desktop one needs
// Steam for its lobby (invite zones), and its panel differs only by the radio volume slider under EFFECTS. Saves screenshots plus the box, own text and
// computed style of every element of the pause screen.
//   [PARITY_LOCALE=<id>] node scripts/parity-capture-match-settings.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-match-settings');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: process.env.PARITY_LOCALE ?? 'en' };
const BOT_NAME = 'EX82R';
const STATE_SETTLE_MS = 350;            // App re-renders the pause every 100 ms

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const measure = () => page.evaluate(() => {
  const screens = [...document.querySelectorAll('.screen')];
  const root = screens[screens.length - 1];
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const own = el => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, color: s.color,
      background: s.backgroundColor, border: s.border, padding: s.padding, margin: s.margin, opacity: s.opacity };
  };
  return [...root.querySelectorAll('*')].map(el => ({ tag: el.tagName.toLowerCase(),
    cls: typeof el.className === 'string' ? el.className : '', testid: el.dataset?.testid ?? null, text: own(el),
    box: box(el), style: style(el) })).filter(item => item.box[2] > 0);
});
const setLock = locked => page.evaluate(isLocked => {
  const canvas = document.querySelector('canvas');
  Object.defineProperty(document, 'pointerLockElement', { get: () => (isLocked ? canvas : null), configurable: true });
  document.dispatchEvent(new Event('pointerlockchange'));
}, locked);

try {
  const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile: PROFILE, botName: BOT_NAME });
  await page.evaluate(() => { window.__debugLockCooldownLeft = 0; });
  await setLock(false);
  await page.mouse.move(0, 0);   // only once unlocked: a move under the (faked) lock turns the camera
  await page.getByTestId('pause-settings').waitFor();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-pause');
  const facts = { mapId, renderer, viewport: VIEWPORT, profile: PROFILE, pause: await measure() };
  await page.getByTestId('pause-settings').click();
  await page.getByTestId('match-settings-back').waitFor();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-match-settings-sound');
  facts.sound = await measure();
  await page.getByTestId('match-settings-tab-graphics').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-match-settings-graphics');
  facts.graphics = await measure();
  facts.errors = errors;
  await writeFile(resolve(output, 'web-match-settings.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ renderer, errors, sound: facts.sound.length, graphics: facts.graphics.length }));
} finally {
  await browser.close();
}
