// The Radio mini-player docked on the desktop menu (components/RadioPlayer collapsed): a stub __TAURI_INTERNALS__ makes
// the page the desktop build (every invoke pends, so the library and the DLC answer never arrive), Chromium may play audio
// without a gesture (the Tauri WebView does), and the parity identity keeps the radio switched off until the capture
// presses play. Frames: the engine ready but off ("—"), then a generated track playing. Saves screenshots plus the boxes,
// computed styles and the platform fonts Chrome drew the name and the transport glyphs with.
// PARITY_FULLSCREEN=1 takes the same frames in the fullscreen window (parity-lib FULLSCREEN), suffixed -fs.
//   node scripts/parity-capture-radio-player.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FULLSCREEN, FULLSCREEN_ON, VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const SUFFIX = FULLSCREEN_ON ? '-fs' : '';
const WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };
const output = resolve(process.argv[2] ?? '../test-results/parity-radio-player');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', radioEnabled: false };
const AUTOPLAY = '--autoplay-policy=no-user-gesture-required';
const SETTLE_TIMEOUT_MS = 30000;
const ENGINE_TIMEOUT_MS = 60000;   // Strudel warms up with the sample maps from the CDN
const TRACK_TIMEOUT_MS = 30000;
const STATE_SETTLE_MS = 1500;      // the play-pause glyph and the name settle; the dock transition is .34 s
const NO_TRACK = '—';

const stubDesktop = () => {
  window.__TAURI_INTERNALS__ = { invoke: () => new Promise(() => {}), transformCallback: () => 0,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } } };
};

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage({ ...WINDOW, extraArgs: [AUTOPLAY] });
const shot = name => page.screenshot({ path: resolve(output, `${name}${SUFFIX}.png`) });
const client = await page.context().newCDPSession(page);
await client.send('DOM.enable');
await client.send('CSS.enable');
const platformFonts = async selector => {
  const { root } = await client.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  return nodeId ? (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : null;
};
const measure = () => page.evaluate(() => {
  const pick = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { box: [r.x, r.y, r.width, r.height], text: el.textContent,
      style: { fontSize: s.fontSize, fontFamily: s.fontFamily, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight,
        color: s.color, opacity: s.opacity, transform: s.transform, border: s.border, borderRadius: s.borderRadius,
        padding: s.padding, background: s.backgroundColor, boxShadow: s.boxShadow, backdropFilter: s.backdropFilter } };
  };
  const q = id => document.querySelector(`[data-testid="${id}"]`);
  return { root: pick(q('radio-player')), card: pick(q('radio-drag')), name: pick(q('radio-track-name')),
    prev: pick(q('radio-prev')), playPause: pick(q('radio-playpause')), next: pick(q('radio-next')),
    transport: pick(q('radio-prev')?.parentElement) };
});
const fonts = async () => ({ name: await platformFonts('[data-testid="radio-track-name"]'),
  prev: await platformFonts('[data-testid="radio-prev"]'), playPause: await platformFonts('[data-testid="radio-playpause"]'),
  next: await platformFonts('[data-testid="radio-next"]') });

try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.addInitScript({ content: `(${stubDesktop})();` });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.evaluate(() => document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; }));
  await page.mouse.move(0, 0);
  const facts = { viewport: WINDOW.viewport, deviceScaleFactor: WINDOW.deviceScaleFactor, profile: PROFILE,
    desktop: await page.evaluate(() => '__TAURI_INTERNALS__' in window) };

  // the engine ready: the transport row loses its 0.45 dim
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="radio-prev"]').parentElement)
    .opacity === '1', null, { timeout: ENGINE_TIMEOUT_MS });
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-radio-ready');
  facts.ready = await measure();
  facts.readyFonts = await fonts();

  await page.getByTestId('radio-playpause').click();
  await page.mouse.move(0, 0);
  await page.waitForFunction(dash => document.querySelector('[data-testid="radio-track-name"]').textContent !== dash,
    NO_TRACK, { timeout: TRACK_TIMEOUT_MS });
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-radio-playing');
  facts.playing = await measure();
  facts.playingFonts = await fonts();

  facts.errors = errors;
  await writeFile(resolve(output, `web-radio-player${SUFFIX}.json`), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ name: facts.playing.name?.text, card: facts.playing.card?.box, fonts: facts.playingFonts }, null, 2));
} finally {
  await browser.close();
}
