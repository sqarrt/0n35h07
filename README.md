# 0N35H07

> A fast, arcade first-person shooter — **1v1, 2v2 or free-for-all**, peer-to-peer, right in the browser.

*"0N35H07" is leetspeak for **OneShot** — the docs use the readable form "OneShot" interchangeably.*

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE)
[![Assets: CC BY-SA 4.0](https://img.shields.io/badge/Assets-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
[![CI](https://github.com/sqarrt/0n35h07/actions/workflows/ci.yml/badge.svg)](https://github.com/sqarrt/0n35h07/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

Built with React 19 · React Three Fiber · Three.js · Rapier (physics) · Trystero (WebRTC P2P) · Vite · TypeScript · Tauri.

## What it is

OneShot is a duel-focused arena shooter: charge a beam, bait your opponent into wasting a shield or dash, dodge at the last moment, and land the one shot that counts. No lobbies full of strangers — just you, up to three others (humans over WebRTC or AI bots), and the arena.

- **Duel, Battle or War — always P2P.** Pick a mode in the lobby: 1v1, 2v2 teams, or a four-way free-for-all. Friends join by code (or a Steam invite); empty seats take bots. No game server, and no host either — every peer simulates the players it owns and the match is a full mesh between them.
- **Human-like bots.** The AI is "just another controller" driving the same intent methods a human keyboard does. Bot personality (skill, accuracy, fire rate, evasion, baiting) is derived deterministically from its nickname — type a name to replay a specific (tough) opponent.
- **Skins & arenas.** Ball models, charge / respawn / dash / shield FX, a paintable ball, a built-in voxel map editor, and several arenas (including a few shoot-through / passable trick maps).
- **10 languages** in the UI.
- **Desktop build** via Tauri (Windows `.msi` / portable `.exe`).

## Quick start

Requirements: **Node `^20.19` or `>=22.12`** (Vite 8 / Rolldown / Vitest need an even, LTS-ish Node).

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

Build & checks:

```bash
npm run build      # tsc -b (full type-check) + production build (app + trailer)
npm run lint       # ESLint
npm run test       # canonical run: Vitest (unit) + Playwright headless (e2e)
```

More test entry points:

```bash
npm run test:unit  # Vitest only
npm run test:e2e   # Playwright headless only
npm run test:headed
```

## Playing online

Matches are P2P over WebRTC. On simple / home networks plain STUN is enough. Symmetric NAT needs a **TURN** relay — credentials are read from env (`VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`). Copy [`.env.example`](./.env.example) to `.env` and fill them in (e.g. free credentials from [metered.ca](https://dashboard.metered.ca)). Without TURN, the online mode still works on non-symmetric NATs.

> Note: front-end TURN credentials are visible to any player in DevTools — env only keeps them out of the repository, it does not make them secret.

## Desktop (Tauri)

```bash
npm run tauri:dev
npm run tauri:build
```

Requires the Rust toolchain + `cargo-tauri`.

## Desktop (Steam) vs Web

The desktop build **is** the Steam version: it links the Steamworks SDK and swaps WebRTC
matchmaking for Steam's. Everything below keys off a single flag — `IS_DESKTOP`
(`src/platform.ts`, true only inside the Tauri shell) — and degrades to a no-op on the web,
so the two builds share one codebase.

| Area | Desktop (Steam) | Web |
|---|---|---|
| **Matchmaking** | Steam quick-match (public lobbies) | — (room codes only) |
| **Play with a friend** | Steam friend invite (overlay + picker), auto-join from invites | Share a `#CODE` room link |
| **Transport** | Steam Datagram Relay (`SteamNet`, no TURN needed) | Trystero / WebRTC P2P (STUN, optional TURN) |
| **Achievements** | 7 Steam achievements (kills, blocks, wins) | — |
| **Cloud saves** | Profile synced via Steam Cloud (last-write-wins) | `localStorage` only |
| **Rich presence** | Friends see In Menu / In Lobby / In Match | — |
| **Network settings tab + status indicator** | Hidden (relay/Trystero-specific) | Shown |
| **Menu music autoplay** | Starts immediately | Waits for the first user gesture (browser policy) |
| **Exit button** | Closes the window | Hidden |
| **Accidental-close guard** | — (handled by the window) | `beforeunload` prompt during a live match |

Desktop and web players never match-make together — the discovery pool namespace includes the
platform (`src/net/poolNamespace.ts`).

## Architecture (the short version)

Three layers, deliberately separated:

- **Simulation** — pure TypeScript in `src/game/` (no React). A single `Player` entity is the human, the bot, and the remote player alike; it composes an injectable `Body` + `IWeapon` + `IShield`. Controllers (`HumanController`, `BotController`) drive the *same* intent methods. `Match` owns the world, players, controllers and is the single place where the rules live (combat, respawn, the ready→countdown→live ritual).
- **R3F host** — a thin `<Canvas>` host that builds the `Match` once and drives it at a fixed 60Hz tick, interpolating the visuals between ticks.
- **HUD / menus** — a React/DOM overlay.

Physics is Rapier's kinematic character controller; combat raycasts run on Three.js mesh hitboxes. Networking is a symmetric full mesh (`src/net/`) with no host authority: every peer simulates the players it owns, and a hit is shooter-claimed but judged by the victim's owner — so the shield that counts is the one on the victim's screen.

Type config note: `erasableSyntaxOnly` is on — **no** `enum`, `namespace`, or constructor parameter-properties.

## Contributing

Issues and PRs are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, the branch/commit conventions, the (mandatory) test gate and the code-style rules. Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md).

Found a security issue? See [SECURITY.md](./SECURITY.md).

## License

- **Code** is licensed under the **GNU Affero General Public License v3.0** — see [LICENSE](./LICENSE). In short: you may use, study, modify and redistribute the code, including over a network, **as long as derivative works stay open under the AGPL** (including hosted / served versions).
- **Assets** (original art, icons, and the music / SFX) are licensed under **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**.
  - All music and sound effects (`src/assets/music`, `src/assets/sfx`) were composed by the author with [**Strudel**](https://strudel.cc) and exported — they are original works.
  - The UI font is **Share Tech Mono** (via the `@fontsource` package), licensed under the **SIL Open Font License 1.1**.

See [CREDITS.md](./CREDITS.md) for the full attribution list.

© Dmitry Shatalov and contributors.
