// The Radio screen's PROGRAM window (components/RadioCodePanel + RadioExplorer.css window chrome) on the desktop build: a
// stub __TAURI_INTERNALS__ makes the page the desktop build, Chromium may play audio without a gesture and write the
// clipboard, the parity identity starts the radio off. The mini-player's name opens the Radio screen, play starts a
// track, the canvases are hidden. Frames: the panel with the track's program, just after a click copied it, minimized
// (the PROGRAM bar over the player) and maximized. Facts: the frame, title, buttons, code box and resize corner boxes and
// styles, the platform fonts, the scrollbar width, the program text and every visual line Chrome wrapped it into.
// PARITY_FULLSCREEN=1 takes the same frames in the fullscreen window, suffixed -fs.
//   node scripts/parity-capture-radio-code.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FULLSCREEN, FULLSCREEN_ON, VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const SUFFIX = FULLSCREEN_ON ? '-fs' : '';
const WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };
const output = resolve(process.argv[2] ?? '../test-results/parity-radio-code');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', radioEnabled: false };
const AUTOPLAY = '--autoplay-policy=no-user-gesture-required';
const SETTLE_TIMEOUT_MS = 30000;
const ENGINE_TIMEOUT_MS = 60000;   // Strudel warms up with the sample maps from the CDN
const TRACK_TIMEOUT_MS = 30000;
const EXPAND_SETTLE_MS = 1500;     // the dock → expand transform is .34 s
const COPIED_SHOT_MS = 300;        // inside the 1.2 s "(copied)" title
const WINDOW_SETTLE_MS = 800;      // the .26 s geometry transition, the .2 s bar entrance
const NO_TRACK = '—';

const stubDesktop = () => {
  window.__TAURI_INTERNALS__ = { invoke: () => new Promise(() => {}), transformCallback: () => 0,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } } };
};

await mkdir(output, { recursive: true });
// The code box scrolls: keep Chrome's scrollbar (the desktop WebView draws theme.css's 5 px strip, it narrows the text)
const { browser, page, errors } = await launchReferencePage({ ...WINDOW, extraArgs: [AUTOPLAY], showScrollbars: true });
await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
const client = await page.context().newCDPSession(page);
await client.send('DOM.enable');
await client.send('CSS.enable');
// One node at a time: every DOM.getDocument renumbers the nodes, so parallel lookups lose each other's ids.
const platformFonts = async selector => {
  const { root } = await client.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  return nodeId ? (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : null;
};
const shot = name => page.screenshot({ path: resolve(output, `${name}${SUFFIX}.png`) });
const hideCanvases = () => page.evaluate(() => document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; }));

const measure = () => page.evaluate(() => {
  const pick = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { box: [r.x, r.y, r.width, r.height], text: el.textContent.slice(0, 80),
      style: { fontSize: s.fontSize, fontFamily: s.fontFamily, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight,
        color: s.color, textShadow: s.textShadow, textTransform: s.textTransform, border: s.border,
        borderRadius: s.borderRadius, padding: s.padding, background: s.backgroundImage !== 'none' ? s.backgroundImage : s.backgroundColor,
        boxShadow: s.boxShadow, opacity: s.opacity } };
  };
  const panel = document.querySelector('[data-testid="radio-code"]');
  const code = document.querySelector('[data-testid="radio-code-copy"]');
  const facts = { panel: pick(panel), title: pick(panel?.querySelector('.rexp-title')),
    titleText: pick(panel?.querySelector('.rexp-title b')), buttons: [...(panel?.querySelectorAll('.rexp-wbtn') ?? [])].map(pick),
    code: pick(code), resize: pick(panel?.querySelector('.rexp-resize')),
    bar: pick(document.querySelector('[data-testid="radio-code-min"]')), player: pick(document.querySelector('[data-testid="radio-player"]')) };
  if (code) {
    facts.scroll = { clientWidth: code.clientWidth, offsetWidth: code.offsetWidth, clientHeight: code.clientHeight,
      scrollHeight: code.scrollHeight, scrollTop: code.scrollTop };
    facts.program = code.textContent;
    const node = code.firstChild;
    const lines = [];
    if (node && node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      let line = null;
      for (let i = 0; i < node.length; i++) {
        const ch = node.data[i];
        if (ch === '\n') { line = null; continue; }
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        if (!line || Math.abs(rect.top - line.top) > 1) { line = { top: rect.top, left: rect.left, start: i, text: '' }; lines.push(line); }
        line.text += ch;
      }
    }
    facts.lines = lines;
  }
  return facts;
});

try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.addInitScript({ content: `(${stubDesktop})();` });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.mouse.move(0, 0);
  const facts = { viewport: WINDOW.viewport, deviceScaleFactor: WINDOW.deviceScaleFactor, profile: PROFILE };

  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="radio-prev"]').parentElement)
    .opacity === '1', null, { timeout: ENGINE_TIMEOUT_MS });
  await page.getByTestId('radio-track-name').click();
  await page.waitForTimeout(EXPAND_SETTLE_MS);
  await page.getByTestId('radio-playpause').click();
  await page.mouse.move(0, 0);
  await page.waitForFunction(dash => document.querySelector('[data-testid="radio-track-name"]').textContent !== dash,
    NO_TRACK, { timeout: TRACK_TIMEOUT_MS });
  await page.waitForTimeout(EXPAND_SETTLE_MS);
  await hideCanvases();
  await shot('web-radio-code');
  facts.open = await measure();
  facts.fonts = { title: await platformFonts('[data-testid="radio-code"] .rexp-title b'),
    buttons: await platformFonts('[data-testid="radio-code"] .rexp-wbtn'), code: await platformFonts('[data-testid="radio-code-copy"]') };

  await page.getByTestId('radio-code-copy').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(COPIED_SHOT_MS);
  await shot('web-radio-code-copied');
  facts.copied = await measure();

  await page.locator('[data-testid="radio-code"] .rexp-wbtn').first().click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(WINDOW_SETTLE_MS);
  await shot('web-radio-code-min');
  facts.minimized = await measure();

  await page.getByTestId('radio-code-min').click();
  await page.waitForTimeout(WINDOW_SETTLE_MS);
  await page.locator('[data-testid="radio-code"] .rexp-wbtn').nth(1).click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(WINDOW_SETTLE_MS);
  await shot('web-radio-code-max');
  facts.maximized = await measure();

  facts.errors = errors;
  await writeFile(resolve(output, `web-radio-code${SUFFIX}.json`), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ panel: facts.open.panel?.box, title: facts.open.title?.box, code: facts.open.code?.box,
    scroll: facts.open.scroll, lines: facts.open.lines?.length, firstLines: facts.open.lines?.slice(0, 4),
    copiedTitle: facts.copied.titleText?.text, bar: facts.minimized.bar?.box, maxPanel: facts.maximized.panel?.box, fonts: facts.fonts }, null, 2));
} finally {
  await browser.close();
}
