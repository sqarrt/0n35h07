// Lobby stage frames without the UI: menu → PLAY with the parity identity (English), then the room's seats as balls on
// the 3D backdrop — the Duel room with a passive bot EX82R on seat 1 (the classic pair pose) and the War preset with
// passive bots B1..B3 on seats 1..3 (the square pose). The .screen overlay, the version chip and the blurred map
// background are hidden; __debugMenuLightAngle pins the orbiting light at 0.
//   node scripts/parity-capture-lobby-stage.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-lobby-stage');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const DUEL_BOT = { slot: 1, name: 'EX82R' };
const WAR_BOTS = [1, 2, 3].map(slot => ({ slot, name: `B${slot}` }));
const SETTLE_TIMEOUT_MS = 30000;
const STAGE_SETTLE_MS = 1500;   // the camera damping, the balls' fade-in and colour easing
// Pinned audio levels for the edge glow frames: a half-lit outline (√(0.1·3.2) ≈ 0.57) and a full one (capped at 1).
const GLOW_LEVELS = [0.1, 1];
const BALL_TIME_S = 1.0;   // the balls' shader clock: wave shape and ring bands (Godot pin_ball_time)

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const addBot = async ({ slot, name }) => {
  await page.getByTestId(`seat-addbot-${slot}`).click();
  await page.getByTestId(`seat-diff-${slot}-passive`).click();
  await page.getByTestId(`lobby-bot-name-${slot}`).fill(name);
  await page.getByTestId(`lobby-bot-name-${slot}`).blur();
};
const shootStage = async name => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    document.querySelectorAll('.screen, .version-chip, .map-bg').forEach(el => { el.style.visibility = 'hidden'; });
  });
  await page.waitForTimeout(STAGE_SETTLE_MS);
  await page.screenshot({ path: resolve(output, `${name}.png`) });
  await page.evaluate(() => {
    document.querySelectorAll('.screen, .version-chip, .map-bg').forEach(el => { el.style.visibility = ''; });
  });
};

try {
  await page.addInitScript(({ profile, ballTime }) => {
    localStorage.setItem('oneshot:profile', JSON.stringify(profile));
    window.__debugMenuLightAngle = 0;
    window.__debugMenuGlowLevel = 0;   // the lobby music would light the edge glow at a random level
    window.__debugMenuBallTime = ballTime;
  }, { profile: PROFILE, ballTime: BALL_TIME_S });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('menu-play').click();
  await page.getByTestId('seat-addbot-1').waitFor();
  await settleScene(page);
  await addBot(DUEL_BOT);
  await shootStage('web-stage-bot');
  await page.getByTestId(`lobby-bot-remove-${DUEL_BOT.slot}`).click();
  await page.getByTestId('mode-tile-ffa').click();
  for (const bot of WAR_BOTS) await addBot(bot);
  await shootStage('web-stage-ffa');
  for (const level of GLOW_LEVELS) {
    await page.evaluate(l => { window.__debugMenuGlowLevel = l; }, level);
    await shootStage(`web-stage-ffa-glow-${level}`);
  }
  const facts = { viewport: VIEWPORT, profile: PROFILE, duelBot: DUEL_BOT, warBots: WAR_BOTS, lightAngle: 0,
    glowLevels: GLOW_LEVELS, errors };
  await writeFile(resolve(output, 'web-lobby-stage.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify(facts));
} finally {
  await browser.close();
}
