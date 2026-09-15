// The Radio screen's LIBRARY window (components/RadioExplorer + RadioExplorer.css) on the desktop build. The stub
// __TAURI_INTERNALS__ answers the fs and path plugins from an in-memory app-data folder seeded with a small library (two
// folders, four tracks at the root, one inside a folder) — every other invoke pends as in the other radio captures. The
// mini-player's name opens the Radio screen; the canvases (backdrop, visualizer) are hidden. Frames: the library at its
// root, a track selected, inside a folder, and a track's context menu. Facts: the window, toolbar, address bar, item,
// status and context-menu boxes, texts and styles, and the platform fonts.
// PARITY_FULLSCREEN=1 takes the same frames in the fullscreen window, suffixed -fs.
//   node scripts/parity-capture-radio-library.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FULLSCREEN, FULLSCREEN_ON, VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';
import { APP_DATA, stubDesktop } from './parity-desktop-stub.mjs';

const SUFFIX = FULLSCREEN_ON ? '-fs' : '';
const WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };
const output = resolve(process.argv[2] ?? '../test-results/parity-radio-library');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', radioEnabled: false };
const SETTLE_TIMEOUT_MS = 30000;
const EXPAND_SETTLE_MS = 1500;
const UI_SETTLE_MS = 600;
const COPIED_SETTLE_MS = 300;                 // past the field's .12 s colour transition, inside its 1.1 s
const COPIED_CLEAR_MS = 1200;
const WINDOW_MENU_AT = FULLSCREEN_ON ? { x: 1500, y: 757 } : { x: 860, y: 440 };   // empty grid, under the first row
const MARQUEE_FROM = WINDOW_MENU_AT;
const MARQUEE_TO = FULLSCREEN_ON ? { x: 1340, y: 607 } : { x: 700, y: 290 };      // over Night Drive, Ashen Drift, Fathom
const MARQUEE_STEPS = 8;
const track = (name, bpm) => JSON.stringify({ v: 2, id: `${name}:0`, name, bpm, bars: 64,
  info: { mood: 'dark_techno', key: 'E', scale: 'phrygian' }, program: `setcpm(${bpm}/4)\narrange()` }, null, 2);
// The seeded library: [path, contents | null for a folder] under the app-data radio root.
const LIBRARY = [
  ['radio', null], ['radio/Ambient', null], ['radio/Night Drive', null],
  ['radio/Ashen Drift.json', track('Ashen Drift', 128)], ['radio/Fathom XS·17.json', track('Fathom XS·17', 134)],
  ['radio/Twin.json', track('Twin', 122)], ['radio/Twin (2).json', track('Twin', 122)],
  ['radio/Night Drive/Lagoon.json', track('Lagoon', 118)],
];


await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage(WINDOW);
const client = await page.context().newCDPSession(page);
await client.send('DOM.enable');
await client.send('CSS.enable');
const platformFonts = async selector => {
  const { root } = await client.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  return nodeId ? (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : null;
};
const hideCanvases = () => page.evaluate(() => document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; }));
const shot = name => page.screenshot({ path: resolve(output, `${name}${SUFFIX}.png`) });
const measure = () => page.evaluate(() => {
  const pick = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { box: [r.x, r.y, r.width, r.height], text: el.textContent,
      style: { fontSize: s.fontSize, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight, color: s.color,
        opacity: s.opacity, border: s.border, borderRadius: s.borderRadius, padding: s.padding,
        background: s.backgroundImage !== 'none' ? s.backgroundImage : s.backgroundColor, boxShadow: s.boxShadow,
        textShadow: s.textShadow, direction: s.direction } };
  };
  const q = sel => document.querySelector(sel);
  const all = sel => [...document.querySelectorAll(sel)].map(pick);
  return { window: pick(q('[data-testid="radio-explorer"]')), title: pick(q('.rexp .rexp-title b')),
    tools: pick(q('.rexp-tools')), toolButtons: all('.rexp-tb'), address: pick(q('.rexp-addr')),
    field: pick(q('.rexp-addr .field')), grid: pick(q('.rexp-grid')), items: all('.rexp-it'),
    icons: all('.rexp-it > div:first-child'), labels: all('.rexp-it .lbl'), status: pick(q('.rexp-status')),
    statusText: pick(q('.rexp-status span')), viz: pick(q('[data-testid="radio-viz-switch"]')),
    menu: pick(q('.rexp-ctx')), menuItems: all('.rexp-mi'), menuKeys: all('.rexp-mi .k'), menuAccels: all('.rexp-mi .acc'),
    rename: pick(q('.rexp-rename')), copiedMark: pick(q('.rexp-copied')), marquee: pick(q('.rexp-marquee')),
    dropItem: pick(q('.rexp-it.dropok')),
    dropIcon: (() => { const el = q('.rexp-it.dropok .rexp-folder'); if (!el) return null;
      const s = getComputedStyle(el, '::after'); return { border: s.border, boxShadow: s.boxShadow, background: s.backgroundImage }; })() };
});

try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.addInitScript(stubDesktop, { appData: APP_DATA, library: LIBRARY });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('radio-track-name').click();
  await page.getByTestId('radio-explorer').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(EXPAND_SETTLE_MS);
  await hideCanvases();
  await shot('web-radio-library');
  const facts = { viewport: WINDOW.viewport, deviceScaleFactor: WINDOW.deviceScaleFactor, profile: PROFILE, appData: APP_DATA,
    library: LIBRARY.map(([p, c]) => [p, c === null ? null : 'track']) };
  facts.root = await measure();
  const eachFonts = async (selector, count) => {   // sequential: DOM ids from parallel lookups go stale
    const out = [];
    for (let i = 1; i <= count; i++) out.push(await platformFonts(`${selector}:nth-of-type(${i})`));
    return out;
  };
  facts.fonts = { title: await platformFonts('.rexp .rexp-title b'), tool: await platformFonts('.rexp-tb'),
    tools: await eachFonts('.rexp-tools .rexp-tb', 3),
    field: await platformFonts('.rexp-addr .field'), label: await platformFonts('.rexp-it .lbl'),
    status: await platformFonts('.rexp-status span'), viz: await platformFonts('[data-testid="radio-viz-switch"]') };

  await page.locator('[data-path="Twin.json"]').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-sel');
  facts.selected = await measure();

  await page.locator('[data-path="Twin.json"]').click({ button: 'right' });
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-ctx');
  facts.context = await measure();
  facts.contextFonts = { item: await platformFonts('.rexp-mi'), items: await eachFonts('.rexp-ctx .rexp-mi', facts.context.menuItems.length) };
  await page.keyboard.press('Escape');
  await page.mouse.click(2, 700);

  // the window's own menu: a right click on the empty grid clears the selection
  await page.mouse.click(WINDOW_MENU_AT.x, WINDOW_MENU_AT.y, { button: 'right' });
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-ctx-window');
  facts.contextWindow = await measure();
  await page.mouse.click(2, 700);

  // F2 on a selected track: the rename field in place of its name
  await page.locator('[data-path="Twin.json"]').click();
  await page.mouse.move(0, 0);
  await page.keyboard.press('F2');
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-rename');
  facts.rename = await measure();
  facts.renameFonts = await platformFonts('.rexp-rename');
  await page.keyboard.press('Escape');

  // a click on the address copies the path: the field turns green with a ✓ for 1.1 s
  await page.locator('.rexp-addr .field').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(COPIED_SETTLE_MS);
  await shot('web-radio-library-copied');
  facts.copied = await measure();
  facts.copiedFonts = await platformFonts('.rexp-copied');
  await page.waitForTimeout(COPIED_CLEAR_MS);

  // a rubber band dragged over the empty grid: every item it touches is selected
  await page.mouse.move(MARQUEE_FROM.x, MARQUEE_FROM.y);
  await page.mouse.down();
  await page.mouse.move(MARQUEE_TO.x, MARQUEE_TO.y, { steps: MARQUEE_STEPS });
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-marquee');
  facts.marquee = await measure();
  await page.mouse.up();
  await page.mouse.click(MARQUEE_FROM.x, MARQUEE_FROM.y);   // a click on the empty grid clears the selection

  // a folder under a dragged track: .dropok set by hand (a synthetic drag shows no drop-target look)
  await page.mouse.move(0, 0);
  await page.locator('[data-path="Night Drive"]').evaluate(el => el.classList.add('dropok'));
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-dropok');
  facts.dropok = await measure();
  await page.locator('[data-path="Night Drive"]').evaluate(el => el.classList.remove('dropok'));

  await page.locator('[data-path="Night Drive"]').dblclick();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-folder');
  facts.folder = await measure();

  // the LIBRARY window minimized: its bar over the player; then PROGRAM minimized too — the last one on top
  const bars = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="radio-explorer-min"], [data-testid="radio-code-min"]')]
    .map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.testid, box: [r.x, r.y, r.width, r.height], text: b.textContent }; }));
  await page.locator('[data-testid="radio-explorer"] .rexp-wbtn').first().click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-bar');
  facts.libraryBar = await bars();
  await page.locator('.rexp:not([data-testid="radio-explorer"]) .rexp-wbtn').first().click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-bars');
  facts.bothBars = await bars();

  facts.errors = errors;
  await writeFile(resolve(output, `web-radio-library${SUFFIX}.json`), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ window: facts.root.window?.box, title: facts.root.title?.text, tools: facts.root.toolButtons.map(b => b?.box),
    field: facts.root.field?.text, items: facts.root.items.map(i => [i.box, i.text]), status: facts.root.statusText?.text,
    viz: facts.root.viz?.text, menu: facts.context.menu?.box, folderTitle: facts.folder.title?.text, errors }, null, 1));
} finally {
  await browser.close();
}
