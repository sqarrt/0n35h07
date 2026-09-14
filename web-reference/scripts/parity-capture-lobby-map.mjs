// The lobby's blurred map background (web components/MapBackground, theme.css .map-bg): menu → PLAY, the 3D backdrop
// canvases, the panel and the version chip hidden so only the map picture is compared, after its 0.7 s fade-in; then the
// map switched to os_india (a single-map pick) and shot once the 320 ms crossfade is over.
//   node scripts/parity-capture-lobby-map.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-lobby-map');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const SWITCH_TO = 'os_india';
const FADE_SETTLE_MS = 1500;      // .map-bg opacity 0.7s ease
const SWITCH_SETTLE_MS = 1000;    // map-snap-out 320ms
const SETTLE_TIMEOUT_MS = 30000;

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const setUiHidden = hidden => page.evaluate(h => {
  document.querySelectorAll('canvas').forEach(c => { c.style.visibility = h ? 'hidden' : ''; });
  document.querySelectorAll('.menu-panel, .version-chip').forEach(el => { el.style.visibility = h ? 'hidden' : ''; });
}, hidden);
const measure = () => page.evaluate(() => {
  const bg = document.querySelector('.map-bg');
  const img = bg?.querySelector('.map-bg-img');
  const s = bg ? getComputedStyle(bg) : null;
  return bg ? { box: [...Object.values(bg.getBoundingClientRect().toJSON())], filter: s.filter, opacity: s.opacity,
    image: img ? { src: img.getAttribute('src'), natural: [img.naturalWidth, img.naturalHeight], objectFit: getComputedStyle(img).objectFit } : null } : null;
});
try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('menu-play').click();
  await page.getByTestId('seat-addbot-1').waitFor();
  await page.mouse.move(0, 0);
  await setUiHidden(true);
  await page.waitForTimeout(FADE_SETTLE_MS);
  await page.screenshot({ path: resolve(output, 'web-map-bg-os_arena.png') });
  const facts = { viewport: VIEWPORT, first: await measure() };
  await setUiHidden(false);
  await page.getByTestId(`lobby-map-${SWITCH_TO}`).click();
  await page.mouse.move(0, 0);
  await setUiHidden(true);
  await page.waitForTimeout(SWITCH_SETTLE_MS);
  await page.screenshot({ path: resolve(output, `web-map-bg-${SWITCH_TO}.png`) });
  facts.switched = await measure();
  facts.errors = errors;
  await writeFile(resolve(output, 'web-lobby-map.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts));
} finally {
  await browser.close();
}
