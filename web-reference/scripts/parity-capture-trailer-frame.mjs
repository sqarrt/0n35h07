// A trailer replay frame (web components/trailer DemoScene + the replay HUD): menu → ABOUT → WATCH with the sequence
// started at a play shot (__debugTrailerShot) and the replay clock held on a recorded frame (__debugTrailerHoldFrame),
// shot once the clips are loaded, the scene has warmed up and the idle cursor / SKIP have hidden.
//   [PARITY_TRAILER_SHOT=<index>] [PARITY_TRAILER_FRAME=<frame>] node scripts/parity-capture-trailer-frame.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-trailer');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const SHOT = Number(process.env.PARITY_TRAILER_SHOT ?? 2);      // the first play shot: os_arena from frame 160
const FRAME = Number(process.env.PARITY_TRAILER_FRAME ?? 160);
const CLIP = process.env.PARITY_TRAILER_CLIP ?? 'os_arena';
const SETTLE_TIMEOUT_MS = 30000;
const REPLAY_SETTLE_MS = 5000;   // clips loaded, warm-up, cover faded, idle cursor hidden (2.5 s)

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
try {
  await page.addInitScript(({ profile, shot, frame }) => {
    localStorage.setItem('oneshot:profile', JSON.stringify(profile));
    window.__debugTrailerShot = shot;
    window.__debugTrailerHoldFrame = frame;
  }, { profile: PROFILE, shot: SHOT, frame: FRAME });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-about').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('menu-about').click();
  await page.getByTestId('about-watch-trailer').click();
  await page.locator('.trailer-root canvas').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await page.waitForTimeout(REPLAY_SETTLE_MS);
  const name = `web-trailer-${CLIP}-${FRAME}`;
  await page.screenshot({ path: resolve(output, `${name}.png`) });
  await writeFile(resolve(output, `${name}.json`), JSON.stringify({ viewport: VIEWPORT, profile: PROFILE, shot: SHOT, clip: CLIP, frame: FRAME, errors }, null, 2));
  console.log(JSON.stringify({ name, errors }));
} finally {
  await browser.close();
}
