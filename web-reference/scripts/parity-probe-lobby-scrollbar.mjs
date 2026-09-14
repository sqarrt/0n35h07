// Probe: the lobby body's classic scrollbar as the desktop WebView draws it — the layout width it takes, the body box
// and its scroll extent. Opens PLAY in the browser build (the body is the same) and saves the frame and the facts.
//   node scripts/parity-probe-lobby-scrollbar.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchReferencePage } from './parity-lib.mjs';

const output = resolve(process.argv[2] ?? '../test-results/probes/web-lobby-scrollbar');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const SETTLE_TIMEOUT_MS = 30000;
const LOBBY_SETTLE_MS = 800;

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage({ showScrollbars: true });
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await page.getByTestId('menu-play').click();
  await page.waitForSelector('.lobby-body', { timeout: SETTLE_TIMEOUT_MS });
  await page.waitForTimeout(LOBBY_SETTLE_MS);
  const facts = await page.evaluate(() => {
    const body = document.querySelector('.lobby-body');
    const rect = body.getBoundingClientRect();
    const style = getComputedStyle(body);
    return {
      box: [rect.x, rect.y, rect.width, rect.height], offsetWidth: body.offsetWidth, clientWidth: body.clientWidth,
      scrollbar: body.offsetWidth - body.clientWidth, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight,
      padding: style.padding, scrollbarWidth: style.scrollbarWidth, scrollbarColor: style.scrollbarColor,
      userAgent: navigator.userAgent,
    };
  });
  await page.screenshot({ path: resolve(output, 'web-lobby-scrollbar.png') });
  await writeFile(resolve(output, 'web-lobby-scrollbar.json'), JSON.stringify({ facts, errors }, null, 2));
  console.log(JSON.stringify({ facts, errors }));
} finally {
  await browser.close();
}
