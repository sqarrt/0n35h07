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

const SUFFIX = FULLSCREEN_ON ? '-fs' : '';
const WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };
const output = resolve(process.argv[2] ?? '../test-results/parity-radio-library');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en', radioEnabled: false };
const APP_DATA = 'C:\\Users\\PARITY7\\AppData\\Roaming\\com.oneshot.game';
const SETTLE_TIMEOUT_MS = 30000;
const EXPAND_SETTLE_MS = 1500;
const UI_SETTLE_MS = 600;
const track = (name, bpm) => JSON.stringify({ v: 2, id: `${name}:0`, name, bpm, bars: 64,
  info: { mood: 'dark_techno', key: 'E', scale: 'phrygian' }, program: `setcpm(${bpm}/4)\narrange()` }, null, 2);
// The seeded library: [path, contents | null for a folder] under the app-data radio root.
const LIBRARY = [
  ['radio', null], ['radio/Ambient', null], ['radio/Night Drive', null],
  ['radio/Ashen Drift.json', track('Ashen Drift', 128)], ['radio/Fathom XS·17.json', track('Fathom XS·17', 134)],
  ['radio/Twin.json', track('Twin', 122)], ['radio/Twin (2).json', track('Twin', 122)],
  ['radio/Night Drive/Lagoon.json', track('Lagoon', 118)],
];

const stubDesktop = ({ appData, library }) => {
  const dirs = new Set(library.filter(([, c]) => c === null).map(([p]) => p));
  const files = new Map(library.filter(([, c]) => c !== null));
  const pending = () => new Promise(() => {});
  const handlers = {
    'plugin:path|resolve_directory': () => appData,
    'plugin:path|join': (args) => args.paths.join('\\'),
    'plugin:fs|mkdir': (args) => { dirs.add(args.path); },
    'plugin:fs|exists': (args) => dirs.has(args.path) || files.has(args.path),
    'plugin:fs|read_dir': (args) => {
      const prefix = `${args.path}/`;
      const out = [];
      for (const d of dirs) if (d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) out.push({ name: d.slice(prefix.length), isDirectory: true, isFile: false, isSymlink: false });
      for (const f of files.keys()) if (f.startsWith(prefix) && !f.slice(prefix.length).includes('/')) out.push({ name: f.slice(prefix.length), isDirectory: false, isFile: true, isSymlink: false });
      return out;
    },
    'plugin:fs|read_text_file': (args) => Array.from(new TextEncoder().encode(files.get(args.path) ?? '')),
    'plugin:fs|write_text_file': (bytes, options) => { files.set(decodeURIComponent(options.headers.path), new TextDecoder().decode(bytes)); },
    'plugin:fs|remove': (args) => { files.delete(args.path); dirs.delete(args.path); },
    'plugin:fs|rename': (args) => { if (files.has(args.oldPath)) { files.set(args.newPath, files.get(args.oldPath)); files.delete(args.oldPath); } },
  };
  window.__TAURI_INTERNALS__ = {
    invoke: (cmd, args, options) => (handlers[cmd] ? Promise.resolve(handlers[cmd](args, options)) : pending()),
    transformCallback: () => 0, metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  };
};

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
    menu: pick(q('.rexp-ctx')), menuItems: all('.rexp-mi') };
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

  await page.locator('[data-path="Night Drive"]').dblclick();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(UI_SETTLE_MS);
  await shot('web-radio-library-folder');
  facts.folder = await measure();

  facts.errors = errors;
  await writeFile(resolve(output, `web-radio-library${SUFFIX}.json`), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ window: facts.root.window?.box, title: facts.root.title?.text, tools: facts.root.toolButtons.map(b => b?.box),
    field: facts.root.field?.text, items: facts.root.items.map(i => [i.box, i.text]), status: facts.root.statusText?.text,
    viz: facts.root.viz?.text, menu: facts.context.menu?.box, folderTitle: facts.folder.title?.text, errors }, null, 1));
} finally {
  await browser.close();
}
