// The trailer finale frame (web FinaleScene + the title card): menu → ABOUT → WATCH with the sequence started at the
// finale (__debugTrailerShot) and its fallback exit held (__debugTrailerHoldClock), the duel stepped at 60 Hz to
// PARITY_FINALE_S (__debugFinaleHoldS), shot once that moment is reached and the title card has fully surfaced.
//   [PARITY_TRAILER_SHOT=<index>] [PARITY_FINALE_S=<seconds>] node scripts/parity-capture-trailer-finale.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-trailer-finale');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const SHOT = Number(process.env.PARITY_TRAILER_SHOT ?? 11);    // the finale
const HOLD_S = Number(process.env.PARITY_FINALE_S ?? 5.2);     // the beams hang, the title is up
const SETTLE_TIMEOUT_MS = 60000;
const TITLE_SETTLED_MS = 5600;              // the title at 3.6 s, the CTA's 0.8 s delay and 0.6 s fade, with margin
const HOLD_EPS = 1e-9;
const TITLE_PARTS = ['.trailer-title', '.trailer-tagline', '.trailer-cta'];

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
try {
  await page.addInitScript(({ profile, shot, hold }) => {
    localStorage.setItem('oneshot:profile', JSON.stringify(profile));
    window.__debugTrailerShot = shot;
    window.__debugTrailerHoldClock = true;
    window.__debugFinaleHoldS = hold;
  }, { profile: PROFILE, shot: SHOT, hold: HOLD_S });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-about').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('menu-about').click();
  await page.getByTestId('about-watch-trailer').click();
  await page.locator('.trailer-root canvas').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  const mounted = Date.now();
  await page.waitForFunction(({ hold, eps }) => (window.__debugFinaleAt ?? 0) >= hold - eps,
    { hold: HOLD_S, eps: HOLD_EPS }, { timeout: SETTLE_TIMEOUT_MS });
  const left = TITLE_SETTLED_MS - (Date.now() - mounted);
  if (left > 0) await page.waitForTimeout(left);
  const title = await page.evaluate((parts) => Object.fromEntries(parts.map((selector) => {
    const element = document.querySelector(selector);
    return [selector, element ? { box: element.getBoundingClientRect().toJSON(), opacity: getComputedStyle(element).opacity } : null];
  })), TITLE_PARTS);
  const finaleAt = await page.evaluate(() => window.__debugFinaleAt);
  const name = `web-trailer-shot-${SHOT}-${Math.round(HOLD_S * 1000)}`;
  await page.screenshot({ path: resolve(output, `${name}.png`) });
  await writeFile(resolve(output, `${name}.json`), JSON.stringify({ viewport: VIEWPORT, profile: PROFILE, shot: SHOT, holdS: HOLD_S, finaleAt, title, errors }, null, 2));
  console.log(JSON.stringify({ name, finaleAt, errors }));
} finally {
  await browser.close();
}
