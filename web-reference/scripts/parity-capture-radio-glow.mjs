// The Radio screen's frosted bloom (components/MenuEdgeGlow softBloom) on the desktop build: the menu backdrop with the
// light orbit, the ball clock and the audio glow level pinned (the __debugMenu* hooks, as the appearance captures), every
// DOM element over the canvas hidden. Frames: the main menu (the edge glow's plain bloom, silent), then the Radio screen
// opened from the mini-player's name (the one bloom morphed to threshold 0 / radius 0.95 at its 0.35 base).
// PARITY_FULLSCREEN=1 takes the same frames in the fullscreen window, suffixed -fs.
//   node scripts/parity-capture-radio-glow.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FULLSCREEN, FULLSCREEN_ON, VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const SUFFIX = FULLSCREEN_ON ? '-fs' : '';
const WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };
const output = resolve(process.argv[2] ?? '../test-results/parity-radio-glow');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', radioEnabled: false };
const BALL_TIME_S = 1.0;           // as parity-capture-appearance.mjs
const SILENT_BANDS = 32;           // more than any reader asks for (the beat clock reads 8)
const SETTLE_TIMEOUT_MS = 30000;
const GLOW_SETTLE_MS = 2000;       // the glow composer mounts after 600 ms; the soft bloom fades in over ~0.2 s

const stubDesktop = () => {
  window.__TAURI_INTERNALS__ = { invoke: () => new Promise(() => {}), transformCallback: () => 0,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } } };
};
// Everything that neither is nor holds the backdrop canvas goes invisible (the canvas's ancestors stay laid out).
const hideUi = () => document.querySelectorAll('body *').forEach(el => {
  if (el.tagName !== 'CANVAS' && !el.querySelector('canvas')) el.style.visibility = 'hidden';
});

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage(WINDOW);
try {
  await page.addInitScript(({ profile, ballTime, silentBands }) => {
    localStorage.setItem('oneshot:profile', JSON.stringify(profile));
    window.__debugMenuLightAngle = 0;
    window.__debugMenuGlowLevel = 0;
    window.__debugMenuBallTime = ballTime;
    // A silent spectrum: the menu music keeps playing with the radio off, and its kicks would fire the takeover's beats
    // (camera punches, emoji) — the bands feed only the beat clock and the HUD bar, not this glow.
    window.__debugAudioBands = new Float32Array(silentBands);
  }, { profile: PROFILE, ballTime: BALL_TIME_S, silentBands: SILENT_BANDS });
  await page.addInitScript({ content: `(${stubDesktop})();` });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(GLOW_SETTLE_MS);
  await page.evaluate(`(${hideUi})()`);
  await page.screenshot({ path: resolve(output, `web-radio-glow-menu${SUFFIX}.png`) });

  await page.evaluate(() => document.querySelectorAll('body *').forEach(el => { el.style.visibility = ''; }));
  await page.getByTestId('radio-track-name').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(GLOW_SETTLE_MS);
  await page.evaluate(`(${hideUi})()`);
  await page.screenshot({ path: resolve(output, `web-radio-glow-radio${SUFFIX}.png`) });

  const facts = { viewport: WINDOW.viewport, deviceScaleFactor: WINDOW.deviceScaleFactor, profile: PROFILE,
    pins: { lightAngle: 0, glowLevel: 0, ballTime: BALL_TIME_S }, errors };
  await writeFile(resolve(output, `web-radio-glow${SUFFIX}.json`), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts, null, 2));
} finally {
  await browser.close();
}
