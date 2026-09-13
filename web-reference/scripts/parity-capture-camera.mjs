// Camera view frames (CAM1 / G12): the live first-person view, then the over-the-shoulder third-person view after
// the V key, with the camera position and FOV of each frame.
//   node scripts/parity-capture-camera.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-camera');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const cameraFacts = () => page.evaluate(() => {
  const c = window.__debugCamera;
  return { position: [c.position.x, c.position.y, c.position.z], fov: c.fov };
});
try {
  const renderer = await enterLiveMatch(page, base, mapId);
  await page.screenshot({ path: resolve(output, 'web-first-person.png') });
  const firstPerson = await cameraFacts();
  await page.keyboard.press('KeyV');
  await settleScene(page);
  await page.screenshot({ path: resolve(output, 'web-third-person.png') });
  const thirdPerson = await cameraFacts();
  const facts = { mapId, renderer, viewport: VIEWPORT, firstPerson, thirdPerson,
    player: await page.evaluate(() => window.__debugPlayerPos?.(0)), errors };
  await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ output, facts }));
} finally {
  await browser.close();
}
