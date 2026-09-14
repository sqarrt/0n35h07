// Appearance style preview frames as the desktop build: menu → APPEARANCE, then for each state a style click with the
// preview clock frozen that long after it (__debugPreviewHoldMs), the whole screen with the 3D backdrop once the camera
// has reached the clicked block's pose. Between states every running preview is let finish. The light, ball clock and
// glow are pinned. States: <kind>-<style>-<ms after the click>.
//   node scripts/parity-capture-appearance-preview.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-appearance-preview');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
/** [preview kind, the appearance testid group, style, ms after the click]. */
const STATES = [
  ['shot', 'windup', 'rage', 140],       // before the jaws' first glitch coin flip (160 ms): no random jerk yet
  ['shot', 'windup', 'singularity', 300],
  ['shot', 'windup', 'classic', 460],   // 60 ms into the beam: one frame of web rAF jitter shifts its life
  ['respawn', 'respawn', 'echo', 600],
  ['respawn', 'respawn', 'swarm', 1300],
  ['dash', 'dash', 'rift', 250],
  ['shield', 'shield', 'hex', 300],
];
const SETTLE_TIMEOUT_MS = 30000;
const FINISH_MS = 2600;           // the longest preview (ghost 1200 + rebirth 500) has ended
const POSE_SETTLE_MS = 1500;      // the camera reaches the block's pose
const BALL_TIME_S = 1.0;

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage({ showScrollbars: true });
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
  await page.getByTestId('menu-appearance').click();
  await page.getByTestId('appearance-back').waitFor();
  const shots = [];
  for (const [kind, group, style, ms] of STATES) {
    await page.evaluate(() => { delete window.__debugPreviewHoldMs; });
    await page.waitForTimeout(FINISH_MS);
    await page.evaluate(hold => { window.__debugPreviewHoldMs = hold; }, ms);
    await page.getByTestId(`appearance-${group}-${style}`).click();
    // Playwright scrolls the button into view before clicking — a player scrolls by hand; the frames keep the top
    await page.evaluate(() => { const fill = document.querySelector('.panel-fill'); if (fill) fill.scrollTop = 0; });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(POSE_SETTLE_MS);
    const name = `web-preview-${kind}-${style}-${ms}`;
    await page.screenshot({ path: resolve(output, `${name}.png`) });
    shots.push(name);
  }
  const facts = { viewport: VIEWPORT, profile: PROFILE, states: STATES, shots, errors };
  await writeFile(resolve(output, 'web-appearance-preview.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ shots: shots.length, errors }));
} finally {
  await browser.close();
}
