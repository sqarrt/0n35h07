import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, SETTLE_FRAMES, SETTLE_MS, launchReferencePage, settleScene, enterLiveMatch } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-corrected');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';   // e.g. PARITY_MAP=os_pool_day
await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
try {
  const renderer = await enterLiveMatch(page, base, mapId, async stage => {
    switch (stage) {
      case 'menu':
        await shot('web-menu');
        await settleScene(page);
        await shot('web-menu-later');
        break;
      case 'lobby':
        await shot('web-lobby');
        await writeFile(resolve(output, 'web-lobby.txt'), await page.locator('body').innerText());
        break;
      case 'lobby-with-bot': await shot('web-lobby-with-bot'); break;
      case 'countdown': await shot('web-countdown'); break;
      case 'live': await shot('web-game'); break;
    }
  });
  const runtime = { mapId, renderer, viewport: VIEWPORT, settleFrames: SETTLE_FRAMES, settleMs: SETTLE_MS, errors };
  const saveRuntime = () => writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(runtime, null, 2));
  await saveRuntime();   // the map frame is captured: keep its facts even if a later step fails
  // Shot: optional — on maps where the bot is out of the line of fire there is no hit to wait for.
  try {
    const before = await page.evaluate(() => window.__debugTargetHitCount ?? 0);
    await page.evaluate(() => {
      const target = window.__debugBotPos?.[0]?.();
      if (!target) throw new Error('No bot position available');
      window.__debugCamera.lookAt(target.x, target.y + 0.5, target.z);
      window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    });
    await page.waitForFunction(count => (window.__debugTargetHitCount ?? 0) > count, before, { timeout: 10000 });
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));
    await shot('web-hit');
    // Streak banner frame: inside the fully visible stretch (5%..90%) of the 2.05 s ks-annShow flicker.
    const BANNER_FRAME_MS = 600;
    await page.waitForTimeout(BANNER_FRAME_MS);
    await shot('web-banner');
  } catch (error) {
    runtime.shotSkipped = error.message;
  }
  runtime.facts = await page.evaluate(() => ({
    phase: window.__debugPhase?.(),
    score: window.__debugScore?.(0),
    hits: window.__debugTargetHitCount,
    position: window.__debugPlayerPos?.(0),
  }));
  // Match end: take the time-up path, then let the freeze-frame and the outcome fade-in settle.
  await page.evaluate(() => window.__debugForceEnd?.());
  await page.getByTestId('match-outcome').waitFor({ timeout: 10000 });
  await settleScene(page);
  await shot('web-match-end');
  runtime.matchEnd = {
    outcome: await page.getByTestId('match-outcome').innerText(),
    reason: await page.getByTestId('match-reason').innerText(),
  };
  await saveRuntime();
  console.log(JSON.stringify({ output, facts: runtime.facts, shotSkipped: runtime.shotSkipped, errors }));
} finally {
  await browser.close();
}
