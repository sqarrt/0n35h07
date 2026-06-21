# OneShot

> A fast, arcade first-person shooter — strictly **1v1**, peer-to-peer, right in the browser.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE)
[![Assets: CC BY-SA 4.0](https://img.shields.io/badge/Assets-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
[![CI](https://github.com/sqarrt/0n35h07/actions/workflows/ci.yml/badge.svg)](https://github.com/sqarrt/0n35h07/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

Built with React 19 · React Three Fiber · Three.js · Rapier (physics) · Trystero (WebRTC P2P) · Vite · TypeScript · Tauri.

> ℹ️ The codebase comments, commit messages and changelog are written in **Russian** — the project grew up Russian-first. The public docs (this README, CONTRIBUTING, etc.) are in English for reach. Contributions in either language are welcome.

## What it is

OneShot is a duel-focused arena shooter: charge a beam, bait your opponent into wasting a shield or dash, dodge at the last moment, and land the one shot that counts. No teams, no lobbies full of strangers — just you, one opponent (a human over WebRTC or an AI bot), and the arena.

- **Strictly 1v1, always P2P.** The room creator is the host; a second player joins by code. No game server — the host authoritatively simulates the match and streams snapshots to the client.
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

Matches are P2P over WebRTC. On simple / home networks plain STUN is enough. Symmetric NAT needs a **TURN** relay — credentials are read from env (`VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`), never committed. Copy [`.env.example`](./.env.example) to `.env` and fill them in (e.g. free credentials from [metered.ca](https://dashboard.metered.ca)). Without TURN, the online mode still works on non-symmetric NATs.

> Note: front-end TURN credentials are visible to any player in DevTools — env only keeps them out of the repository, it does not make them secret.

## Desktop (Tauri)

```bash
npm run tauri:dev
npm run tauri:build
```

Requires the Rust toolchain + `cargo-tauri`.

## Architecture (the short version)

Three layers, deliberately separated:

- **Simulation** — pure TypeScript in `src/game/` (no React). A single `Player` entity is the human, the bot, and the remote player alike; it composes an injectable `Body` + `IWeapon` + `IShield`. Controllers (`HumanController`, `BotController`) drive the *same* intent methods. `Match` owns the world, players, controllers and is the single place where the rules live (combat, respawn, the ready→countdown→live ritual).
- **R3F host** — a thin `<Canvas>` host that builds the `Match` once and runs a single `useFrame` tick.
- **HUD / menus** — a React/DOM overlay.

Physics is Rapier's kinematic character controller; combat raycasts run on Three.js mesh hitboxes. Networking is host-authoritative (`src/net/`): only the host computes hits; the client predicts its own movement and renders remotes from snapshots.

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
