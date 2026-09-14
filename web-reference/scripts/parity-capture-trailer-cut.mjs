// A trailer countdown / text-cut frame (web TrailerSequencer + theme.css .trailer-cut): menu → ABOUT → WATCH with the
// sequence started at a shot (__debugTrailerShot) and its timers held (__debugTrailerHoldClock), the shot's CSS
// animations paused at the moment asked for. PARITY_TRAILER_AWAKE=1 first moves the mouse, so SKIP fades in.
//   [PARITY_TRAILER_SHOT=<index>] [PARITY_TRAILER_MS=<ms>] [PARITY_TRAILER_AWAKE=1] node scripts/parity-capture-trailer-cut.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/parity-trailer-cut');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const SHOT = Number(process.env.PARITY_TRAILER_SHOT ?? 1);     // the first text cut
const MS = Number(process.env.PARITY_TRAILER_MS ?? 117);       // 13% of the 900 ms cut: the slam
const AWAKE = process.env.PARITY_TRAILER_AWAKE === '1';
const SHOT_ANIMATIONS = ['cdPop', 'trailer-cut-text', 'trailer-cut-bar'];
const SETTLE_TIMEOUT_MS = 30000;
const SKIP_FADE_MS = 500;                   // SKIP's 0.3 s opacity transition, with margin
const SEEK_COMMIT_MS = 300;                 // the frozen styles and the paused bar reach the compositor
const FROZEN_PROPERTIES = ['opacity', 'transform', 'letterSpacing', 'textShadow'];
const MOUSE = { x: 100, y: 100 };           // away from SKIP: no hover look

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage();
try {
  await page.addInitScript(({ profile, shot }) => {
    localStorage.setItem('oneshot:profile', JSON.stringify(profile));
    window.__debugTrailerShot = shot;
    window.__debugTrailerHoldClock = true;
  }, { profile: PROFILE, shot: SHOT });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-about').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  await page.getByTestId('menu-about').click();
  await page.getByTestId('about-watch-trailer').click();
  await page.waitForFunction((names) => document.getAnimations().some((a) => names.includes(a.animationName)),
    SHOT_ANIMATIONS, { timeout: SETTLE_TIMEOUT_MS });
  if (AWAKE) {
    await page.mouse.move(MOUSE.x, MOUSE.y);
    await page.mouse.move(MOUSE.x + 1, MOUSE.y);
    await page.waitForTimeout(SKIP_FADE_MS);
  }
  await page.evaluate(({ names, ms }) => {
    for (const animation of document.getAnimations()) {
      if (!names.includes(animation.animationName)) continue;
      animation.pause();
      animation.currentTime = ms;
    }
  }, { names: SHOT_ANIMATIONS, ms: MS });
  // A transform / opacity animation runs on the compositor, which a paused seek does not reach (the shot would show its
  // old frame): an element's animated values become its inline style instead. A pseudo-element's stays paused.
  await page.evaluate(({ names, properties }) => {
    for (const animation of document.getAnimations()) {
      const target = animation.effect?.target;
      if (!names.includes(animation.animationName) || !target || animation.effect.pseudoElement) continue;
      const style = getComputedStyle(target);
      const frozen = Object.fromEntries(properties.map((property) => [property, style[property]]));
      target.style.animation = 'none';
      Object.assign(target.style, frozen);
    }
  }, { names: SHOT_ANIMATIONS, properties: FROZEN_PROPERTIES });
  await page.waitForTimeout(SEEK_COMMIT_MS);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  // What was frozen, and how the animated elements ended up (the facts behind the frame).
  const animations = await page.evaluate(() => document.getAnimations().map((animation) => {
    const target = animation.effect?.target;
    const style = target ? getComputedStyle(target) : null;
    return { name: animation.animationName ?? animation.transitionProperty, state: animation.playState,
      currentTime: animation.currentTime, text: target?.textContent?.slice(0, 40) ?? null,
      opacity: style?.opacity ?? null, transform: style?.transform ?? null,
      box: target ? target.getBoundingClientRect().toJSON() : null };
  }));
  // SKIP's box and the faces Chrome draws it with (the ▸ is not in the UI font).
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  const { root } = await client.send('DOM.getDocument');
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.trailer-skip' });
  const skip = nodeId ? {
    fonts: (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts,
    box: await page.locator('.trailer-skip').evaluate((element) => element.getBoundingClientRect().toJSON()),
  } : null;
  const name = `web-trailer-shot-${SHOT}-${MS}${AWAKE ? '-awake' : ''}`;
  await page.screenshot({ path: resolve(output, `${name}.png`) });
  await writeFile(resolve(output, `${name}.json`), JSON.stringify({ viewport: VIEWPORT, profile: PROFILE, shot: SHOT, ms: MS, awake: AWAKE, animations, skip, errors }, null, 2));
  console.log(JSON.stringify({ name, errors }));
} finally {
  await browser.close();
}
