// The Play screen's Steam states as the desktop build: a stub __TAURI_INTERNALS__ answers the Steam commands the lobby
// uses (our SteamID, a Private lobby entered at once, the friends list, a quick-match search that finds nothing and hosts)
// and delivers "steam-net" / "steam-invite" events to the page's listeners. With the parity identity (PARITY7, en) and the
// backdrop canvases hidden, frames: the invite toast over the menu, the hosted Duel lobby (top and bottom), the friend
// picker, a friend waiting on seat 1 (the pulse paused at its peak) and quick match searching. Saves screenshots plus the
// boxes and computed styles as JSON.
// PARITY_FULLSCREEN=1 takes the same frames in the fullscreen window (parity-lib FULLSCREEN), suffixed -fs.
//   node scripts/parity-capture-lobby-steam.mjs <output dir> [base url]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FULLSCREEN, VIEWPORT, launchReferencePage, settleScene } from './parity-lib.mjs';

const FULLSCREEN_ON = process.env.PARITY_FULLSCREEN === '1';
const SUFFIX = FULLSCREEN_ON ? '-fs' : '';
const WINDOW = FULLSCREEN_ON ? FULLSCREEN : { viewport: VIEWPORT, deviceScaleFactor: 1 };

const output = resolve(process.argv[2] ?? '../test-results/parity-lobby-steam');
const base = process.argv[3] ?? 'http://127.0.0.1:5173/?net=bc';
const PROFILE = { name: 'PARITY7', primaryColor: '#fa4', reserveColor: '#4af', locale: 'en' };
const STEAM = {
  self: '100', lobby: '900', searchLobby: '901',
  friends: [{ id: '11', name: 'alice', online: true }, { id: '22', name: 'Bob', online: true },
    { id: '33', name: 'zed', online: false }],
  invite: { inviterName: 'alice', inviterId: '300', lobbyId: '555' },
  picked: '22',
};
const SETTLE_TIMEOUT_MS = 30000;
const STATE_SETTLE_MS = 600;     // the toast's .24 s entrance, the carousel's .25 s ease
const PULSE_PEAK_MS = 550;       // invitePulse 1.1 s: opacity 1 halfway

// Runs in the page before the app: the Tauri IPC the desktop build talks to, answering only the Steam lobby commands
// (anything else never resolves, like the other desktop captures).
const stubSteam = steam => {
  const callbacks = new Map();
  const listeners = {};
  let nextId = 1;
  const emit = (event, payload) => (listeners[event] ?? []).forEach(id => callbacks.get(id)?.({ event, id: 0, payload }));
  const later = fn => setTimeout(fn, 0);
  const entered = lobbyId => later(() => emit('steam-net', { kind: 'lobbyEntered', lobbyId, self: steam.self, members: [steam.self] }));
  const answers = {
    'plugin:event|listen': args => { (listeners[args.event] ??= []).push(args.handler); return args.handler; },
    'plugin:event|unlisten': args => { listeners[args.event] = (listeners[args.event] ?? []).filter(id => id !== args.eventId); return null; },
    steam_net_self: () => steam.self,
    steam_net_create_lobby: () => { entered(steam.lobby); return null; },
    steam_mm_search: () => { later(() => emit('steam-net', { kind: 'mmResult', lobbies: [] })); return null; },
    steam_mm_host: () => { entered(steam.searchLobby); return null; },
    steam_net_join_lobby: () => null,
    steam_net_leave_lobby: () => null,
    steam_net_send: () => true,
    steam_friends_list: () => steam.friends,
    steam_invite_to_lobby: () => true,
    steam_decline_invite: () => null,
    steam_take_launch_connect: () => null,
  };
  window.__steamEmit = emit;
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {   // unlisten drops the page-side listener before the IPC call
    unregisterListener: (event, eventId) => { listeners[event] = (listeners[event] ?? []).filter(id => id !== eventId); },
  };
  window.__TAURI_INTERNALS__ = {
    invoke: (cmd, args) => (cmd in answers ? Promise.resolve(answers[cmd](args ?? {})) : new Promise(() => {})),
    transformCallback: cb => { const id = nextId++; callbacks.set(id, cb); return id; },
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  };
};

await mkdir(output, { recursive: true });
const { browser, page, errors } = await launchReferencePage({ showScrollbars: true, ...WINDOW });   // the WebView's bar
const shot = name => page.screenshot({ path: resolve(output, `${name}${SUFFIX}.png`) });
const client = await page.context().newCDPSession(page);
await client.send('DOM.enable');
await client.send('CSS.enable');
// The faces Chrome actually drew a node's text with (the ✕ glyphs come from a system fallback).
const platformFonts = async selector => {
  const { root } = await client.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  return nodeId ? (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : null;
};
const hideBackdrops = () => page.evaluate(() => {
  document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; });
  document.querySelectorAll('.map-bg').forEach(m => { m.style.visibility = 'hidden'; });
});
const toTop = () => page.evaluate(() => { const body = document.querySelector('.lobby-body'); if (body) body.scrollTop = 0; });
const toBottom = () => page.evaluate(() => { const body = document.querySelector('.lobby-body'); if (body) body.scrollTop = body.scrollHeight; });
const holdPulse = () => page.evaluate(peak => document.getAnimations()
  .filter(a => a.animationName === 'invitePulse').forEach(a => { a.pause(); a.currentTime = peak; }), PULSE_PEAK_MS);
const measure = () => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const own = el => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
  const style = el => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, fontStyle: s.fontStyle, letterSpacing: s.letterSpacing,
      lineHeight: s.lineHeight, color: s.color, background: s.backgroundColor, border: s.border, borderRadius: s.borderRadius,
      padding: s.padding, opacity: s.opacity, boxShadow: s.boxShadow, backdropFilter: s.backdropFilter };
  };
  const all = selector => [...document.querySelectorAll(selector)].map(el => ({
    box: box(el), text: el.textContent, own: own(el), testid: el.dataset.testid ?? null, style: style(el) }));
  const body = document.querySelector('.lobby-body');
  return {
    scroll: body ? { top: body.scrollTop, height: body.scrollHeight, client: body.clientHeight } : null,
    seats: all('.lobby-seat'), zones: all('.seat-zone'), nicks: all('.lobby-nick'), wait: all('.lobby-seat-wait'),
    waitDot: all('.lobby-seat-waitdot'), cancel: all('.lobby-seat-cancel'), opts: all('.lobby-opts'),
    action: all('[data-testid="lobby-action"] button'), back: all('[data-testid="lobby-back"]'),
    picker: all('.lobby-picker'), pickerTitle: all('.lobby-picker-ttl'), pickerClose: all('.lobby-picker-x'),
    pickerInput: all('.lobby-picker-input'), pickerCount: all('.lobby-picker-count'), pickerList: all('.lobby-picker-list'),
    pickerRows: all('.lobby-picker-row'), pickerDots: all('.lobby-picker-dot'), pickerNames: all('.lobby-picker-name'),
    pickerInvites: all('.lobby-picker-invite'), pickerNote: all('.lobby-picker-note'),
    toast: all('.invite-toast'), toastTitle: all('.invite-title'), toastName: all('.invite-title strong'),
    toastButtons: all('.invite-btn'),
  };
});
const shotBottom = async name => {
  await toBottom();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot(`${name}-bottom`);
  const facts = await measure();
  await toTop();
  return facts;
};

try {
  await page.addInitScript(p => localStorage.setItem('oneshot:profile', JSON.stringify(p)), PROFILE);
  await page.addInitScript({ content: `(${stubSteam})(${JSON.stringify(STEAM)});` });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-play').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await settleScene(page);
  const facts = { viewport: WINDOW.viewport, deviceScaleFactor: WINDOW.deviceScaleFactor, profile: PROFILE, steam: STEAM,
    desktop: await page.evaluate(() => '__TAURI_INTERNALS__' in window) };
  await hideBackdrops();
  await page.mouse.move(0, 0);

  await page.evaluate(invite => window.__steamEmit('steam-invite', invite), STEAM.invite);
  await page.getByTestId('invite-modal').waitFor();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-steam-toast');
  facts.toast = await measure();
  await page.getByTestId('invite-decline').click();
  await page.mouse.move(0, 0);

  await page.getByTestId('menu-play').click();
  await page.getByTestId('seat-invite-1').waitFor({ timeout: SETTLE_TIMEOUT_MS });
  await page.waitForTimeout(STATE_SETTLE_MS);   // the scene settled before the toast; the canvases stay hidden
  await hideBackdrops();
  await page.mouse.move(0, 0);
  await toTop();
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-steam-idle');
  facts.idle = await measure();
  facts.idleBottom = await shotBottom('web-steam-idle');

  await page.getByTestId('seat-invite-1').click();
  await page.getByTestId('lobby-friend-picker').waitFor();
  await toTop();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(STATE_SETTLE_MS);
  await shot('web-steam-picker');
  facts.picker = await measure();
  facts.pickerFonts = { close: await platformFonts('.lobby-picker-x'), name: await platformFonts('.lobby-picker-name') };

  await page.getByTestId(`lobby-friend-${STEAM.picked}`).click();
  await page.getByTestId('lobby-invite-cancel-1').waitFor();
  await page.mouse.move(0, 0);
  await holdPulse();
  facts.invitedBottom = await shotBottom('web-steam-invited');
  facts.seatFonts = { cancel: await platformFonts('.lobby-seat-cancel') };

  await page.getByTestId('lobby-invite-cancel-1').click();
  await page.getByTestId('lobby-search').click();
  await page.getByTestId('lobby-stop').waitFor();
  await page.mouse.move(0, 0);
  facts.searchingBottom = await shotBottom('web-steam-searching');

  facts.errors = errors;
  await writeFile(resolve(output, `web-lobby-steam${SUFFIX}.json`), JSON.stringify(facts, null, 2));
  console.log(JSON.stringify({ desktop: facts.desktop, errors }));
} finally {
  await browser.close();
}
