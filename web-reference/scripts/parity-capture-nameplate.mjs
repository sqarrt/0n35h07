// Name plate frames: a Battle match (parity identity, passive bots B1..B3 as in parity-capture-teams.mjs) with the enemy
// bot 2 placed 4 units in front of the camera (horizontal look) through __debugPlace, so its plate is readable. Saves
// the live frame plus the placed position and the camera pose as JSON.
//   node scripts/parity-capture-nameplate.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-nameplate');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const mode = process.env.PARITY_MODE ?? '2v2';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const BOT_SLOTS = [1, 2, 3];
const PLACED_ID = 2;
const PLACE_DISTANCE = 4;
const SETTLE_TIMEOUT_MS = 30000;
const PLACE_SETTLE_MS = 400;

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('menu-play').click();
  await page.getByTestId(`lobby-map-${mapId}`).click();
  await page.getByTestId(`mode-tile-${mode}`).click();
  for (const slot of BOT_SLOTS) {
    await page.getByTestId(`seat-addbot-${slot}`).click();
    await page.getByTestId(`seat-diff-${slot}-passive`).click();
    await page.getByTestId(`lobby-bot-name-${slot}`).fill(`B${slot}`);
  }
  await page.getByTestId('lobby-ready').click();
  await page.waitForFunction(() => !!window.__debugCamera, null, { timeout: SETTLE_TIMEOUT_MS });
  await page.evaluate(() => window.__debugReady?.());
  await page.waitForFunction(() => window.__debugPhysicsReady?.() && window.__debugPhase?.() === 'live', null,
    { timeout: SETTLE_TIMEOUT_MS });
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await settleScene(page);
  const placed = await page.evaluate(({ id, distance }) => {
    const camera = window.__debugCamera;
    const look = [0, 0, -1];
    const e = camera.matrixWorld.elements;          // column 2 = camera +Z; the look is -Z
    look[0] = -e[8]; look[2] = -e[10];
    const len = Math.hypot(look[0], look[2]) || 1;
    const target = [camera.position.x + look[0] / len * distance, null, camera.position.z + look[2] / len * distance];
    return { camera: [camera.position.x, camera.position.y, camera.position.z], target,
      result: window.__debugPlace?.(id, target[0], target[2]) ?? null };
  }, { id: PLACED_ID, distance: PLACE_DISTANCE });
  if (!placed.result) throw new Error('__debugPlace hook missing: restart the Vite dev server');
  await page.waitForTimeout(PLACE_SETTLE_MS);
  await page.screenshot({ path: resolve(output, `web-nameplate-${mode}.png`) });
  const facts = { viewport: VIEWPORT, mode, mapId, placedId: PLACED_ID, ...placed, errors };
  await writeFile(resolve(output, `web-nameplate-${mode}.json`), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts));
} finally {
  await browser.close();
}
