// Streak text effect frames (H3): the banner for every announce kind and the HUD name at every streak tier,
// forced through the __debugAnnounce / __debugStreak hooks in a live match with a passive bot.
//   node scripts/parity-capture-streak.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-streak');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const KINDS = ['catalyst', 'double', 'triple', 'singularity'];
const TIER_STREAKS = { double: 2, triple: 3, singularity: 5 };
const BANNER_FRAME_MS = 600;      // same moment as the main capture: inside the fully visible stretch of ks-annShow
const BANNER_GONE_MS = 2300;      // ks-annShow lasts 2.05 s; the announce payload clears after 2 s
const NAME_FRAME_MS = 600;
const LOCAL_ID = 0;
const BOT_ID = 1;
await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
try {
  const renderer = await enterLiveMatch(page, base, mapId);
  const color = await page.evaluate(id => window.__debugPlayerColor?.(id), LOCAL_ID);
  for (const kind of KINDS) {
    await page.evaluate(k => window.__debugAnnounce?.(k), kind);
    await page.waitForTimeout(BANNER_FRAME_MS);
    await shot(`web-banner-${kind}`);
    await page.waitForTimeout(BANNER_GONE_MS);
  }
  for (const [tier, streak] of Object.entries(TIER_STREAKS)) {
    await page.evaluate(({ id, n }) => window.__debugStreak?.(id, n), { id: LOCAL_ID, n: streak });
    await page.evaluate(({ id, n }) => window.__debugStreak?.(id, n), { id: BOT_ID, n: streak });
    await page.waitForTimeout(NAME_FRAME_MS);
    await shot(`web-names-${tier}`);
  }
  const facts = { mapId, renderer, viewport: VIEWPORT, playerColor: color, bannerFrameMs: BANNER_FRAME_MS,
    nameFrameMs: NAME_FRAME_MS, names: await page.getByTestId('match-hud').innerText(), errors };
  await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ output, facts }));
} finally {
  await browser.close();
}
