// Settings and About frames as the desktop build: a stub __TAURI_INTERNALS__ makes IS_DESKTOP true (no NETWORK tab,
// the radio volume slider, QUIT in the menu). The menu, then menu → SETTINGS on each desktop tab (PLAYER / SOUND /
// GRAPHICS), then menu → ABOUT, with the parity identity in PARITY_LOCALE (default en) and the backdrop canvases hidden
// so the panel content alone is compared. Saves screenshots plus the box, own text and computed style of every element
// inside the panel.
//   [PARITY_LOCALE=<id>] node scripts/parity-capture-settings.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-settings');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: process.env.PARITY_LOCALE ?? 'en' };
const TABS = ['player', 'sound', 'graphics'];
const SETTLE_TIMEOUT_MS = 30000;
const STATE_SETTLE_MS = 400;

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const hideBackdrops = () => page.evaluate(() => {
  document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; });
  document.querySelectorAll('.map-bg').forEach(m => { m.style.visibility = 'hidden'; });
});
const measure = (container = '.panel-fill') => page.evaluate(selector => {
  const fill = document.querySelector(selector);
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const own = el => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight,
      color: s.color, background: s.backgroundColor, border: s.border, borderBottom: s.borderBottom, padding: s.padding,
      margin: s.margin, opacity: s.opacity, textAlign: s.textAlign };
  };
  const items = [...fill.querySelectorAll('*')].map(el => ({
    tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '',
    testid: el.dataset?.testid ?? null, text: own(el), value: 'value' in el ? String(el.value) : null,
    box: box(el), style: style(el),
  })).filter(item => item.box[2] > 0);
  return { fill: box(fill), items };
}, container);

try {
  await page.addInitScript(p => {
    localStorage.setItem('oneshot:profile', JSON.stringify(p));
    window.__TAURI_INTERNALS__ = { invoke: () => new Promise(() => {}), transformCallback: () => 0,
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } } };
  }, PROFILE);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-settings').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  const facts = { viewport: VIEWPORT, profile: PROFILE, desktop: await page.evaluate(() => '__TAURI_INTERNALS__' in window) };
  await hideBackdrops();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-menu');
  facts.menu = await measure('.menu-panel');
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('settings-back').waitFor();
  await hideBackdrops();
  for (const tab of TABS) {
    await page.getByTestId(`settings-section-${tab}`).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(STATE_SETTLE_MS);
    await shot(`web-settings-${tab}`);
    facts[`settings-${tab}`] = await measure();
  }
  await page.getByTestId('settings-back').click();
  await page.getByTestId('menu-about').click();
  await page.getByTestId('about-back').waitFor();
  await hideBackdrops();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-about');
  facts.about = await measure();
  facts.errors = errors;
  await writeFile(resolve(output, 'web-settings.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ desktop: facts.desktop, errors, tabs: TABS.map(t => facts[`settings-${t}`].items.length) }));
} finally {
  await browser.close();
}
