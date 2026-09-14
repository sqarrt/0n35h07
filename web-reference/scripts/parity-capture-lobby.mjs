// Lobby ("Play" screen) frames: menu → PLAY with the parity identity (PARITY_LOCALE, default en), the backdrop canvases and the blurred
// map background hidden so the panel content alone is compared. Frames: the fresh Duel room, with a passive bot named
// EX82R, the Battle and the War presets (each scrolled to the top). Saves screenshots plus element boxes, computed
// styles and the lobby body's scroll metrics as JSON.
//   node scripts/parity-capture-lobby.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-lobby');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: process.env.PARITY_LOCALE ?? 'en' };
const BOT_NAME = 'EX82R';
const SETTLE_TIMEOUT_MS = 30000;
const STATE_SETTLE_MS = 450;   // the carousel eases over 0.25 s

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const hideBackdrops = () => page.evaluate(() => {
  document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; });
  document.querySelectorAll('.map-bg').forEach(m => { m.style.visibility = 'hidden'; });
});
const toTop = () => page.evaluate(() => { const body = document.querySelector('.lobby-body'); if (body) body.scrollTop = 0; });
const toBottom = () => page.evaluate(() => { const body = document.querySelector('.lobby-body'); if (body) body.scrollTop = body.scrollHeight; });
// The seats and the join-by-code row sit below the fold: each state is also shot scrolled to the end.
const shotBottom = async name => {
  await toBottom();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot(`${name}-bottom`);
  const facts = await measure();
  await toTop();
  return facts;
};
const measure = () => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, color: s.color,
      background: s.backgroundColor, border: s.border, borderRadius: s.borderRadius, padding: s.padding,
      opacity: s.opacity, transform: s.transform, textShadow: s.textShadow, boxShadow: s.boxShadow };
  };
  const all = (selector, withStyle = false) => [...document.querySelectorAll(selector)].map(el => ({
    box: box(el), text: el.textContent, testid: el.dataset.testid ?? null, role: el.dataset.role ?? null,
    ...(withStyle ? { style: style(el) } : {}) }));
  const body = document.querySelector('.lobby-body');
  return {
    panelFill: all('.panel-fill'), lobby: all('.lobby'), body: all('.lobby-body'),
    scroll: body ? { top: body.scrollTop, height: body.scrollHeight, client: body.clientHeight } : null,
    title: all('.lobby-body h2', true), carousel: all('.mode-carousel'), tiles: all('.mode-tile', true),
    tileNames: all('.mode-tile-name', true), labels: all('.lobby-ol', true), segs: all('.seg', true),
    mapTiles: all('.map-tile', true), mapPreviews: all('.map-preview'), mapLabels: all('.map-tile-label', true),
    seats: all('.lobby-seat', true), vs: all('.lobby-vs', true), zones: all('.seat-zone', true),
    nicks: all('.lobby-nick', true), joinCode: all('.join-code'),
    ready: all('[data-testid="lobby-ready"]', true), back: all('[data-testid="lobby-back"]', true),
  };
});

try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('menu-play').click();
  await page.getByTestId('seat-addbot-1').waitFor();
  await settleScene(page);
  await page.mouse.move(0, 0);
  await hideBackdrops();
  await toTop();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-lobby');
  const fresh = await measure();
  const freshBottom = await shotBottom('web-lobby');

  await page.getByTestId('seat-addbot-1').click();
  await page.getByTestId('seat-diff-1-passive').click();
  await page.getByTestId('lobby-bot-name-1').fill(BOT_NAME);
  await page.getByTestId('lobby-bot-name-1').blur();
  await page.mouse.move(0, 0);
  await toTop();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-lobby-bot');
  const withBot = await measure();
  const withBotBottom = await shotBottom('web-lobby-bot');

  await page.getByTestId('lobby-bot-remove-1').click();
  const modes = {};
  for (const mode of ['2v2', 'ffa']) {
    await page.getByTestId(`mode-tile-${mode}`).click();
    await page.mouse.move(0, 0);
    await toTop();
    await page.waitForTimeout(STATE_SETTLE_MS);
    await shot(`web-lobby-${mode}`);
    modes[mode] = { top: await measure(), bottom: await shotBottom(`web-lobby-${mode}`) };
  }
  const facts = { viewport: VIEWPORT, profile: PROFILE, botName: BOT_NAME, fresh, freshBottom, withBot, withBotBottom, modes, errors };
  await writeFile(resolve(output, 'web-lobby.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ fresh: { scroll: fresh.scroll, title: fresh.title, tiles: fresh.tiles.map(t => [t.role, t.box]),
    seats: fresh.seats.map(s => s.box), ready: fresh.ready.map(r => r.box), back: fresh.back.map(b => b.box) }, errors }));
} finally {
  await browser.close();
}
