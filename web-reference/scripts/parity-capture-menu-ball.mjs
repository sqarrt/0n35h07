// Menu backdrop frames without the UI: the English menu with the parity identity, the whole .screen overlay (panel,
// logo, buttons) and the version chip hidden so only the 3D backdrop canvas shows — the player's ball in the default
// camera pose. __debugMenuLightAngle pins the orbiting light, so each frame is taken at a known light angle.
//   node scripts/parity-capture-menu-ball.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-menu-ball');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const SETTLE_TIMEOUT_MS = 30000;
const ANGLE_SETTLE_MS = 300;
const ANGLES_DEG = [0, 90];

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
try {
  await page.addInitScript(p => {
    localStorage.setItem('oneshot:profile', JSON.stringify(p));
    window.__debugMenuLightAngle = 0;
  }, PROFILE);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.mouse.move(0, 0);
  // The whole menu over the backdrop first (the panel's 72% fill and backdrop blur over the ball), then the ball alone.
  for (const deg of ANGLES_DEG) {
    await page.evaluate(rad => { window.__debugMenuLightAngle = rad; }, deg * Math.PI / 180);
    await page.waitForTimeout(ANGLE_SETTLE_MS);
    await page.screenshot({ path: resolve(output, `web-menu-full-${deg}.png`) });
  }
  await page.evaluate(() => {
    document.querySelectorAll('.screen, .version-chip').forEach(el => { el.style.visibility = 'hidden'; });
  });
  for (const deg of ANGLES_DEG) {
    await page.evaluate(rad => { window.__debugMenuLightAngle = rad; }, deg * Math.PI / 180);
    await page.waitForTimeout(ANGLE_SETTLE_MS);
    await page.screenshot({ path: resolve(output, `web-menu-ball-${deg}.png`) });
  }
  const facts = { viewport: VIEWPORT, profile: PROFILE, anglesDeg: ANGLES_DEG, errors };
  await writeFile(resolve(output, 'web-menu-ball.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts));
} finally {
  await browser.close();
}
