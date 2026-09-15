# 0N35H07

> A fast, arcade first-person shooter — **1v1, 2v2 or free-for-all**, peer-to-peer over Steam.

*"0N35H07" is leetspeak for **OneShot** — the docs use the readable form "OneShot" interchangeably.*

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE)
[![Assets: CC BY-SA 4.0](https://img.shields.io/badge/Assets-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
[![CI](https://github.com/sqarrt/0n35h07/actions/workflows/ci.yml/badge.svg)](https://github.com/sqarrt/0n35h07/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

Built with Godot 4.7 (GDScript) · GodotSteam · godot_wry · Strudel (the generative radio).

## What it is

OneShot is a duel-focused arena shooter: charge a beam, bait your opponent into wasting a shield or dash, dodge at the
last moment, and land the one shot that counts. Just you, up to three others (Steam friends or AI bots), and the arena.

- **Duel, Battle or War — always P2P.** Pick a mode in the lobby: 1v1, 2v2 teams, or a four-way free-for-all. Invite
  friends through Steam or quick-match; empty seats take bots. No game server and no host authority — every peer
  simulates the players it owns and the match is a full mesh between them.
- **Human-like bots.** The AI is "just another controller" driving the same intents a keyboard does. A bot's personality
  (skill, accuracy, fire rate, evasion, baiting) is derived deterministically from its name.
- **Skins & arenas.** Ball models, charge / respawn / dash / shield effects, a paintable ball, and several arenas.
- **The radio.** A generative music station (Strudel) with a library of saved tracks — the soundtrack for menus and
  matches.
- **Steam.** Achievements, Cloud-synced profile, Rich Presence, lobbies and invites.
- **10 languages** in the UI.

## Quick start

Requirements: **Godot 4.7.1** (standard build).

```bash
# the unit tests (GUT), headless — the first time run the import once
godot --headless --path . --import
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit
```

Open `project.godot` in the editor to play (the run scene is `scenes/main_menu.tscn`). On Windows, `scripts/godot.ps1`
runs the binary from `$env:GODOT_BIN`; in WSL / Linux, `scripts/godot.sh` does.

## Windows build and Steam

```powershell
$env:GODOT_BIN = "C:\path\to\Godot_v4.7.1-stable_win64.exe"
./scripts/export_windows.ps1                                  # → release/windows/0N35H07.exe (the Steam depot)
./scripts/upload_steam.ps1 -App 4881310 -User <login> -DryRun # SteamPipe build scripts; drop -DryRun to upload
```

The export needs the Godot 4.7.1 export templates installed. A shipped build takes the Steam app from its launch; to
run it outside Steam put a `steam_appid.txt` with the app id beside the exe.

## The radio page

The radio's engine is web code (Strudel) that the game hosts in an off-screen WebView. Its source is the `radio-host/`
package, built into `localhost/radio_host/`:

```bash
cd radio-host
npm ci
npm test            # Vitest
npm run build       # → ../localhost/radio_host (commit the rebuilt bundle)
```

## Architecture (the short version)

- **`sim/`** — engine-agnostic game logic: a single `Player` (human, bot and remote player alike) composing a body, a beam
  weapon and a shield; controllers drive the same intents; the match rules, bots, streaks and the lobby / room models.
- **`nodes/` + `scenes/`** — the Godot hosts: the player body, the match coordinator, the HUD, menus, lobby, radio UI and
  the trailer.
- **`sim/net/`** — a symmetric full mesh over Steam relay: every peer simulates what it owns, a hit is claimed by the
  shooter but judged by the victim's owner — so the shield that counts is the one on the victim's screen.

## Contributing

Issues and PRs are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, the branch/commit conventions, the
(mandatory) test gate and the code-style rules. Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md).

Found a security issue? See [SECURITY.md](./SECURITY.md).

## License

- **Code** is licensed under the **GNU Affero General Public License v3.0** — see [LICENSE](./LICENSE). In short: you
  may use, study, modify and redistribute the code, including over a network, **as long as derivative works stay open
  under the AGPL**.
- **Assets** (original art, icons, and the music / SFX) are licensed under
  **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**.
  - All music and sound effects (`assets/audio`) were composed by the author with [**Strudel**](https://strudel.cc) and
    exported — they are original works.
  - The UI font is **Share Tech Mono**, licensed under the **SIL Open Font License 1.1**.

See [CREDITS.md](./CREDITS.md) for the full attribution list.

© Dmitry Shatalov and contributors.
