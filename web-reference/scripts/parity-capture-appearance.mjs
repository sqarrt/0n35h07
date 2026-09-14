// Appearance frames as the desktop build (a stub __TAURI_INTERNALS__): menu → APPEARANCE with the parity identity in
// PARITY_LOCALE (default en). For each state the panel alone (canvases hidden) and the whole screen with the 3D backdrop (the preview ball
// and the camera pose of the last clicked block; the orbiting light and the ball clock pinned), plus the boxes, own
// texts and computed styles of every element inside the panel and its scroll metrics. States: fresh (part color), the
// reserve colour being edited, the planet model, and one painted front cell (part paintFront).
//   [PARITY_LOCALE=<id>] node scripts/parity-capture-appearance.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-appearance');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: process.env.PARITY_LOCALE ?? 'en' };
const RESERVE_PICK = '#4fa';
const PAINT_CELL = { cx: 8, cy: 8 };      // a cell inside the disc
const FIELD_CELLS = 16;
const SETTLE_TIMEOUT_MS = 30000;
const STATE_SETTLE_MS = 1500;             // the damped panel slide, the camera pose and the colour easing
const BALL_TIME_S = 1.0;

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage({ showScrollbars: true });   // the panel scrolls
const setBackdropVisible = visible => page.evaluate(v => {
  document.querySelectorAll('canvas').forEach(c => { if (!c.closest('.panel-fill')) c.style.visibility = v ? '' : 'hidden'; });
}, visible);
const measure = () => page.evaluate(() => {
  const fill = document.querySelector('.panel-fill');
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const own = el => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, letterSpacing: s.letterSpacing, color: s.color, background: s.backgroundColor,
      border: s.border, boxShadow: s.boxShadow, opacity: s.opacity, transform: s.transform, margin: s.margin };
  };
  const items = [...fill.querySelectorAll('*')].map(el => ({
    tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '',
    testid: el.dataset?.testid ?? null, text: own(el), box: box(el), style: style(el),
  })).filter(item => item.box[2] > 0);
  const panel = document.querySelector('.menu-panel');
  return { panel: box(panel), panelTransform: getComputedStyle(panel).transform, fill: box(fill),
    scroll: { top: fill.scrollTop, height: fill.scrollHeight, client: fill.clientHeight }, items };
});
const shoot = async name => {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(STATE_SETTLE_MS);
  await page.screenshot({ path: resolve(output, `web-${name}-full.png`) });
  await setBackdropVisible(false);
  await page.screenshot({ path: resolve(output, `web-${name}.png`) });
  const facts = await measure();
  await setBackdropVisible(true);
  return facts;
};

try {
  await page.addInitScript(({ profile, ballTime }) => {
    localStorage.setItem('oneshot:profile', JSON.stringify(profile));
    window.__TAURI_INTERNALS__ = { invoke: () => new Promise(() => {}), transformCallback: () => 0,
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } } };
    window.__debugMenuLightAngle = 0;
    window.__debugMenuGlowLevel = 0;
    window.__debugMenuBallTime = ballTime;
  }, { profile: PROFILE, ballTime: BALL_TIME_S });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-appearance').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  const facts = { viewport: VIEWPORT, profile: PROFILE };
  await page.getByTestId('menu-appearance').click();
  await page.getByTestId('appearance-back').waitFor();
  facts.fresh = await shoot('appearance');
  await page.getByTestId(`appearance-reserve-${RESERVE_PICK}`).click();
  facts.reserve = await shoot('appearance-reserve');
  await page.getByTestId('appearance-model-planet').click();
  facts.planet = await shoot('appearance-planet');
  const field = await page.getByTestId('paint-front').boundingBox();
  const cell = field.width / FIELD_CELLS;
  await page.mouse.click(field.x + (PAINT_CELL.cx + 0.5) * cell, field.y + (PAINT_CELL.cy + 0.5) * cell);
  facts.paint = await shoot('appearance-paint');
  facts.storedProfile = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile')));
  facts.errors = errors;
  await writeFile(resolve(output, 'web-appearance.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ errors, scroll: facts.fresh.scroll, panel: facts.fresh.panel, art: facts.storedProfile.ballArt }));
} finally {
  await browser.close();
}
