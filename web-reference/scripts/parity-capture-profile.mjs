// Player identity frames (P1): a fixed profile (name + colour) and bot name, captured in the live HUD, with a double
// streak on both names, and on the match-end screen.
//   node scripts/parity-capture-profile.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-profile');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const BOT_NAME = 'EX82R';
const DOUBLE_STREAK = 2;
const NAME_FRAME_MS = 600;
const LOCAL_ID = 0;
const BOT_ID = 1;
await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
try {
  const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile: PROFILE, botName: BOT_NAME });
  await shot('web-hud');
  for (const id of [LOCAL_ID, BOT_ID]) await page.evaluate(({ i, n }) => window.__debugStreak?.(i, n), { i: id, n: DOUBLE_STREAK });
  await page.waitForTimeout(NAME_FRAME_MS);
  await shot('web-hud-double');
  const hudText = await page.getByTestId('match-hud').innerText();
  await page.evaluate(() => window.__debugForceEnd?.());
  await page.getByTestId('match-outcome').waitFor({ timeout: 10000 });
  await settleScene(page);
  await shot('web-match-end');
  const facts = { mapId, renderer, viewport: VIEWPORT, profile: PROFILE, botName: BOT_NAME,
    colors: await page.evaluate(ids => ids.map(id => window.__debugPlayerColor?.(id)), [LOCAL_ID, BOT_ID]),
    hudText, ranking: await page.getByTestId('match-ranking').innerText(), errors };
  await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ output, facts }));
} finally {
  await browser.close();
}
