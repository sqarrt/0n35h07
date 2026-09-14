// Ready-phase frames: menu → lobby on os_arena → the mode's seats filled with passive bots → READY, then the match's
// ready ritual before anyone confirms (web ReadyOverlay: the side tints, the players' corners or list, the "[LMB] to
// start" hint and the controls legend). Modes: duel (the corners) and 2v2 (the centred list). Saves screenshots plus
// the boxes, texts, styles and platform fonts of the overlay's elements.
//   [PARITY_LOCALE=<id>] node scripts/parity-capture-ready.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-ready');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: process.env.PARITY_LOCALE ?? 'en' };
const MODES = { duel: { tile: null, bots: [1] }, '2v2': { tile: '2v2', bots: [1, 2, 3] } };
const BOT_NAMES = { duel: ['EX82R'], '2v2': ['B1', 'B2', 'B3'] };   // the Godot fixtures' names
const SETTLE_TIMEOUT_MS = 30000;
const READY_SETTLE_MS = 1500;

await mkdir(output, { recursive: true });
const facts = { viewport: VIEWPORT, profile: PROFILE };
const { browser, page, errors } = await launchReferencePage();
const measure = () => page.evaluate(() => {
  const root = document.querySelector('.ready-overlay');
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const own = el => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, fontFamily: s.fontFamily, letterSpacing: s.letterSpacing, color: s.color,
      background: s.backgroundImage !== 'none' ? s.backgroundImage : s.backgroundColor, border: s.border,
      borderRadius: s.borderRadius, padding: s.padding, textDecoration: s.textDecorationLine };
  };
  return [...root.querySelectorAll('*')].map(el => ({ tag: el.tagName.toLowerCase(),
    cls: typeof el.className === 'string' ? el.className : '', testid: el.dataset?.testid ?? null, text: own(el),
    box: box(el), style: style(el) })).filter(item => item.box[2] > 0);
});
try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  for (const [mode, cfg] of Object.entries(MODES)) {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
    await settleScene(page);
    await page.getByTestId('menu-play').click();
    await page.getByTestId('seat-addbot-1').waitFor();
    if (cfg.tile) {
      await page.getByTestId(`mode-tile-${cfg.tile}`).click();
      await page.waitForTimeout(500);
    }
    await page.getByTestId('lobby-map-os_arena').click();
    for (const [i, slot] of cfg.bots.entries()) {
      await page.getByTestId(`seat-addbot-${slot}`).click();
      await page.getByTestId(`seat-diff-${slot}-passive`).click();
      await page.getByTestId(`lobby-bot-name-${slot}`).fill(BOT_NAMES[mode][i]);
    }
    await page.getByTestId('lobby-ready').click();
    await page.locator('.ready-overlay').waitFor({ timeout: SETTLE_TIMEOUT_MS });
    await settleScene(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(READY_SETTLE_MS);
    await page.screenshot({ path: resolve(output, `web-ready-${mode}.png`) });
    facts[mode] = await measure();
    const client = await page.context().newCDPSession(page);
    await client.send('DOM.enable'); await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument', { depth: -1 });
    facts[`${mode}Fonts`] = {};
    for (const selector of ['.ready-corner', '.ready-hint', '.ready-hint .hkey', '.ready-legend span[style*="monospace"]']) {
      const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      if (nodeId) facts[`${mode}Fonts`][selector] = (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
    }
  }
  facts.errors = errors;
  await writeFile(resolve(output, 'web-ready.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ errors, duel: facts.duel.length, '2v2': facts['2v2'].length, fonts: facts.duelFonts }));
} finally {
  await browser.close();
}
