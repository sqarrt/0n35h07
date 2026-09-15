// The Radio screen's expanded player (components/RadioPlayer expanded) on the desktop build: a stub __TAURI_INTERNALS__
// makes the page the desktop build (every invoke pends — no library, no DLC answer), Chromium may play audio without a
// gesture, and the parity identity keeps the radio off until the capture presses play. The mini-player's name opens the
// Radio screen; the canvases (backdrop, takeover, glow) are hidden. Frames: the engine ready but off, then a generated
// track playing. Saves screenshots plus boxes, computed styles, platform fonts, the scrub fill and the time labels.
// PARITY_FULLSCREEN=1 takes the same frames in the fullscreen window, suffixed -fs. A production build (vite preview)
// with PARITY_TRIAL=<gens> shows the free-trial strip: the profile caches "DLC not owned" and today's generations used.
//   node scripts/parity-capture-radio-screen.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FULLSCREEN, FULLSCREEN_ON, VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const TRIAL_GENS = process.env.PARITY_TRIAL === undefined ? null : Number(process.env.PARITY_TRIAL);
const SUFFIX = `${TRIAL_GENS === null ? '' : '-trial'}${FULLSCREEN_ON ? '-fs' : ''}`;
const WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };
const output = resolve(process.argv[2] ?? '../test-results/parity-radio-screen');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', radioEnabled: false,
  ...(TRIAL_GENS === null ? {} : { radioDlcOwned: false, radioTrial: { day: localDay(), gens: TRIAL_GENS, saves: 1 } }) };
const AUTOPLAY = '--autoplay-policy=no-user-gesture-required';
const SETTLE_TIMEOUT_MS = 30000;
const ENGINE_TIMEOUT_MS = 60000;   // Strudel warms up with the sample maps from the CDN
const TRACK_TIMEOUT_MS = 30000;
const EXPAND_SETTLE_MS = 1500;     // the dock → expand transform is .34 s
const PLAY_SETTLE_MS = 4000;       // the scrub bar moves off zero
const NO_TRACK = '—';

const stubDesktop = () => {
  window.__TAURI_INTERNALS__ = { invoke: () => new Promise(() => {}), transformCallback: () => 0,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } } };
};

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage({ ...WINDOW, extraArgs: [AUTOPLAY] });
const client = await page.context().newCDPSession(page);
await client.send('DOM.enable');
await client.send('CSS.enable');
const platformFonts = async selector => {
  const { root } = await client.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  return nodeId ? (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : null;
};
const IDS = ['radio-player', 'radio-drag', 'radio-track-name', 'radio-scrub-row', 'radio-scrub', 'radio-scrub-fill',
  'radio-prev', 'radio-playpause', 'radio-next', 'radio-air', 'radio-ball', 'radio-trial', 'radio-unlock',
  'radio-gen-limit', 'radio-back', 'radio-code'];
const measure = () => page.evaluate(ids => {
  const pick = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { box: [r.x, r.y, r.width, r.height], text: el.textContent,
      style: { fontSize: s.fontSize, fontFamily: s.fontFamily, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight,
        color: s.color, opacity: s.opacity, transform: s.transform, border: s.border, borderRadius: s.borderRadius,
        padding: s.padding, background: s.backgroundColor, boxShadow: s.boxShadow, gap: s.gap } };
  };
  const q = id => document.querySelector(`[data-testid="${id}"]`);
  const out = Object.fromEntries(ids.map(id => [id, pick(q(id))]));
  const card = q('radio-drag');
  out.rows = card ? [...card.children].map(pick) : [];
  const scrub = q('radio-scrub-row');
  out.times = scrub ? [...scrub.querySelectorAll('span')].map(s => s.textContent) : [];
  const slider = document.querySelector('input.slider[aria-label="radio volume"]');
  out.volume = pick(slider);
  out.volumeRow = pick(slider?.parentElement);
  return out;
}, IDS);
// One node at a time: every DOM.getDocument renumbers the nodes, so parallel lookups lose each other's ids.
const fonts = async () => {
  const out = {};
  for (const id of ['radio-track-name', 'radio-scrub-row', 'radio-air', 'radio-ball', 'radio-back', 'radio-trial', 'radio-prev']) {
    out[id] = await platformFonts(`[data-testid="${id}"]`);
  }
  return out;
};

try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.addInitScript({ content: `(${stubDesktop})();` });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.mouse.move(0, 0);
  const facts = { viewport: WINDOW.viewport, deviceScaleFactor: WINDOW.deviceScaleFactor, profile: PROFILE,
    desktop: await page.evaluate(() => '__TAURI_INTERNALS__' in window) };

  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="radio-prev"]').parentElement)
    .opacity === '1', null, { timeout: ENGINE_TIMEOUT_MS });
  await page.getByTestId('radio-track-name').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(EXPAND_SETTLE_MS);
  await page.evaluate(() => document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; }));
  await page.screenshot({ path: resolve(output, `web-radio-screen-ready${SUFFIX}.png`) });
  facts.ready = await measure();
  facts.readyFonts = await fonts();

  if (TRIAL_GENS === null) {
    await page.getByTestId('radio-playpause').click();
    await page.mouse.move(0, 0);
    await page.waitForFunction(dash => document.querySelector('[data-testid="radio-track-name"]').textContent !== dash,
      NO_TRACK, { timeout: TRACK_TIMEOUT_MS });
    await page.waitForTimeout(PLAY_SETTLE_MS);
    await page.evaluate(() => document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; }));
    await page.screenshot({ path: resolve(output, `web-radio-screen-playing${SUFFIX}.png`) });
    facts.playing = await measure();
    facts.playingFonts = await fonts();
  }

  facts.errors = errors;
  await writeFile(resolve(output, `web-radio-screen${SUFFIX}.json`), JSON.stringify(facts, null, 2));
  const view = facts.playing ?? facts.ready;
  console.log(JSON.stringify({ card: view['radio-drag']?.box, rows: view.rows.map(r => r?.box), times: view.times,
    trial: view['radio-trial']?.text, back: view['radio-back']?.box }, null, 2));
} finally {
  await browser.close();
}
