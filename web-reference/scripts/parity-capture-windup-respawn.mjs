// Windup world parts and respawn skin frames (G11d), in third person with the parity identity (PARITY7 #fa4):
//   web-windup-<style>.png   rage / singularity, 200 ms into an own charge (sim clock slowed by __debugTimeScale);
//   web-ghost-<style>.png    echo / chaos / swarm, 600 ms into a ghost phase started by __debugKill (slowed);
//   web-rebirth-<style>.png  ~140 ms after materialising. The rebirth window runs on Date.now, which the time scale
//                            does not slow, so this frame is taken in real time and its measured offset is recorded.
//   node scripts/parity-capture-windup-respawn.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, enterLiveMatch, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-windup-respawn');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const mapId = process.env.PARITY_MAP ?? 'os_arena';
const WINDUP_STYLES = ['rage', 'singularity'];
const RESPAWN_STYLES = ['echo', 'chaos', 'swarm'];
const HUMAN_ID = 0;
const TIME_SCALE = 0.05;              // 1 sim second takes 20 real seconds
const WINDUP_OFFSET_MS = 200;         // half of BEAM_WINDUP
const GHOST_OFFSET_MS = 600;
const REBIRTH_OFFSET_MS = 140;        // half of the echo poof / the swarm gather
const SCREENSHOT_LEAD_MS = 40;        // start the screenshot slightly early: it lands after the request
const SIM_MARGIN_MS = 10;
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };

await mkdir(output, { recursive: true });
const facts = { mapId, viewport: VIEWPORT, timeScale: TIME_SCALE, windupOffsetMs: WINDUP_OFFSET_MS,
  ghostOffsetMs: GHOST_OFFSET_MS, rebirthTargetMs: REBIRTH_OFFSET_MS, runs: {} };

async function withMatch(key, profile, capture) {
  const { browser, page, errors } = await launchReferencePage();
  try {
    const renderer = await enterLiveMatch(page, base, mapId, async () => {}, { profile, botName: 'EX82R' });
    await page.keyboard.press('KeyV');
    await settleScene(page);
    const missing = await page.evaluate(() => ['__debugTimeScale', '__debugKill', '__debugRespawning']
      .filter(name => typeof window[name] !== 'function'));
    if (missing.length) throw new Error(`hooks missing (${missing}): restart the Vite dev server`);
    facts.runs[key] = { renderer, errors, ...(await capture(page)) };
  } finally {
    await browser.close();
  }
}

for (const style of WINDUP_STYLES) {
  await withMatch(`windup-${style}`, { ...PROFILE, windupStyle: style }, async page => {
    await page.evaluate(k => window.__debugTimeScale(k), TIME_SCALE);
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })));
    await page.waitForTimeout((WINDUP_OFFSET_MS - SIM_MARGIN_MS) / TIME_SCALE);
    await page.screenshot({ path: resolve(output, `web-windup-${style}.png`) });
    return {};
  });
}

for (const style of RESPAWN_STYLES) {
  await withMatch(`respawn-${style}`, { ...PROFILE, respawnStyle: style }, async page => {
    await page.evaluate(k => window.__debugTimeScale(k), TIME_SCALE);
    await page.evaluate(id => window.__debugKill(id), HUMAN_ID);
    await page.waitForTimeout((GHOST_OFFSET_MS - SIM_MARGIN_MS) / TIME_SCALE);
    await page.screenshot({ path: resolve(output, `web-ghost-${style}.png`) });
    await page.evaluate(() => window.__debugTimeScale(1));
    // Detect the materialisation on the animation frame it lands, then wait out the offset in real time.
    const materialisedAt = await page.evaluate(id => new Promise(done => {
      const poll = () => (window.__debugRespawning(id) ? requestAnimationFrame(poll) : done(Date.now()));
      poll();
    }), HUMAN_ID);
    await page.waitForFunction(([at, wait]) => Date.now() - at >= wait, [materialisedAt,
      REBIRTH_OFFSET_MS - SCREENSHOT_LEAD_MS], { polling: 'raf' });
    const requested = await page.evaluate(() => Date.now());
    await page.screenshot({ path: resolve(output, `web-rebirth-${style}.png`) });
    const finished = await page.evaluate(() => Date.now());
    return { rebirthRequestedMs: requested - materialisedAt, rebirthFinishedMs: finished - materialisedAt };
  });
}

await writeFile(resolve(output, 'web-runtime.json'), JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts));
