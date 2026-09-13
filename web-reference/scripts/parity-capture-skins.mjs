// Ball skin frames (G11a): the fixed parity identity (PARITY7 #fa4 smooth; bot EX82R, whose name rolls the planet
// model in #fd4 with a #f55 ring) seen in third person at rest, halfway through an own windup and right after the
// shot (deflate), with the camera facts.
//   node scripts/parity-capture-skins.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-skins');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const BOT_NAME = 'EX82R';
const HALF_WINDUP_MS = 200;         // BEAM_WINDUP 400 ms
const DEFLATE_FRAME_MS = 250;       // 50 ms after the shot: inside the 200 ms deflate window
await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const camera = () => page.evaluate(() => {
  const c = window.__debugCamera;
  return { position: [c.position.x, c.position.y, c.position.z], fov: c.fov };
});
try {
  const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile: PROFILE, botName: BOT_NAME });
  await page.keyboard.press('KeyV');
  await settleScene(page);
  await shot('web-tp-rest');
  const rest = await camera();
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })));
  await page.waitForTimeout(HALF_WINDUP_MS);
  await shot('web-tp-windup');
  const windup = { camera: await camera(), windup: await page.evaluate(() => window.__debugWindup?.()) };
  await page.waitForTimeout(DEFLATE_FRAME_MS);
  await shot('web-tp-deflate');
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));
  const facts = { mapId, renderer, viewport: VIEWPORT, profile: PROFILE, botName: BOT_NAME,
    colors: await page.evaluate(() => [0, 1].map(id => window.__debugPlayerColor?.(id))), rest, windup,
    halfWindupMs: HALF_WINDUP_MS, deflateFrameMs: DEFLATE_FRAME_MS, errors };
  await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ output, facts }));
} finally {
  await browser.close();
}
