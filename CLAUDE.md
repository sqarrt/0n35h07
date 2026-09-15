# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 2.0.0 — the Godot game

OneShot (0N35H07) is an arcade first-person shooter for Steam, built natively on **Godot 4.7 (GDScript, Windows)**.
The repo **root is the Godot project** (`project.godot`, `scenes/`, `autoloads/`, `nodes/`, `sim/`, `assets/`,
`maps/`, `addons/`, `tests/unit/`). It is a 1:1 port of the React/Three.js web game, which served as the parity
oracle until the port replaced it and was removed from the repository (its history stays in git). The one piece of
web code the game still runs is the generative radio's engine page, kept as its own package in **`radio-host/`**.

- Two runners, same Godot 4.7.1: **Claude Code works in WSL** → `scripts/godot.sh` (`$GODOT_BIN`, else the Linux binary
  in `~/.local/share/godot/godot`; engine runs need the sandbox disabled). **Codex works natively in Windows /
  PowerShell** → `./scripts/godot.ps1` (set `$env:GODOT_BIN` to the Windows `.exe`, or put `godot` / `godot4` on PATH).

## Base rules

- Avoid unnecessary `cd` (change directory) calls.
  - In particular, do not `cd` into the current working directory (you are already there).
  - Before running a `cd`, double-check you are not already in that directory.
- Do not read @TODO.md.

## Development Rules

- ALWAYS use the Superpowers plugin during development.
- Work in a branch ALWAYS ends with a merge into master, once the user has approved the state of the branch.
- **Commits (multi-line message):** do NOT pass the body via a PowerShell here-string `@'...'@` in the Bash tool —
  bash treats `@'` as literals and `@` characters leak into the message. Write the message to a temp file and
  commit via `git commit -F <file>` (reliable in any shell), or use a bash heredoc (`cat > f <<'EOF' … EOF`).
  The `@'…'@` syntax is allowed ONLY in the PowerShell tool, not in Bash.
- After every change, run the tests headless (the GUT suite; `npm test` in `radio-host/` when the radio page changes)
  and keep the tests up to date with your changes.
- After changes, do a THOUGHTFUL review of your own code so it doesn't snowball into a mass refactor.
- You MUST follow the SOLID, DRY and SRP principles.
- You NEVER use magic numbers. Only named constants.
- Constants must be local.
  - Constants used in a single file — declare them there.
  - Constants used within a directory — declare them at the directory level (`sim/*_const.gd`).
  - Constants needed project-wide — in `sim/constants.gd`.
  - For constants this is a recommendation, not a requirement. Use common sense.
- When working on the UI, watch CAREFULLY that it doesn't "jump".
  - Button sizes must not change between states.
  - Headings must stay in the same place.
  - Element positions should barely change.
- Don't run the app yourself except for probes and verification.
  - The user usually already has it running.

## Tests

- Run the relevant automated checks yourself; do not require the user to compare or verify manually.
- No test may be flaky. If a test simply cannot be stabilised — ask the user whether it can be dropped.
- Behaviour matters more than pixels: flows, transitions and reactions must work as the original did.
- After changes to startup, autoloads or native windows, also check a real launch (not only `-s` tool frames).
- Parity / verification stages produce a NEW standalone HTML report each time:
  `python3 tools/parity/report.py tools/parity/stages/<stage>.json` → `test-results/parity-reports/<stage>-<stamp>/`.
  The tool never overwrites a report. Do NOT publish reports (no Artifacts): keep them as local HTML files.

## GitFlow
- Develop in a separate feature branch.
  - The feature branch is merged locally into the release branch.
  - A feature branch must be cut ONLY from the release branch.
    - If no release branch existed at branching time — create one.
  - The release branch is named "release_{version}".
  - A release branch must be cut ONLY from ACTUAL master branch
  - Confirm the version with the user before creating the release branch.
  - Nothing needs to be pushed: the user pushes the release branch and merges into master themselves.
- The version in `project.godot` (`config/version`), `autoloads/game.gd` (`GAME_VERSION`) and
  `radio-host/package.json` must reflect the release branch version.
- Update CHANGELOG.md before merging into the release branch.

## Commands

- Tests (GUT): `scripts/godot.sh --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit`
  (one script: `-gselect=<test_name>`, a single name; PowerShell: quote `'-gdir=res://tests/unit'`; the first time and
  after adding `class_name`s run `scripts/godot.sh --headless --path . --import` once).
- Run the game headless: `scripts/godot.sh --headless --path . --quit-after 5`.
- Tool frames: `Godot.exe --path . --fixed-fps 60 --resolution 1280x720|--fullscreen -s tools/screenshot.gd -- <scene>
  - res://<png> <frames> <mode>`.
- Windows build (PowerShell, `$env:GODOT_BIN` set): `./scripts/export_windows.ps1 [-Mode debug]` → `release/windows/0N35H07.exe`
  (the Steam depot layout; needs the Godot export templates in `%APPDATA%\Godot\export_templates\4.7.1.stable`). The
  preset lives in `tools/export/windows_preset.cfg` (`export_presets.cfg` stays untracked). A shipped build takes the
  Steam app from its launch: run it outside Steam with a temporary `steam_appid.txt` beside the exe.
- Steam upload (steamcmd on PATH or `$env:STEAMCMD`): `./scripts/upload_steam.ps1 -App 4881310 -User <login> [-Branch
  default] [-DryRun]` — SteamPipe VDFs for `release/windows` (Playtest app: `-App 4888710`).
- Radio page (`radio-host/`, Node `^20.19 || >=22.12`): `npm ci`, `npm test` (vitest), `npm run typecheck`,
  `npm run build` → `localhost/radio_host/` (commit the rebuilt bundle).
- CI (`.github/workflows/ci.yml`): the GUT suite on Godot 4.7.1 Linux headless, plus `radio-host` types / tests / a build
  that must reproduce the committed bundle.

Note on the radio page's TypeScript: `erasableSyntaxOnly` is on — parameter properties (`constructor(private x)`),
enums and namespaces are **forbidden**.

## Architecture (big picture)

**Layers.** `sim/` — engine-agnostic game logic ported 1:1 from the web simulation (plain `RefCounted` classes:
`Body`, `Player`, `Weapon`, `Shield`, `MatchRules`, `MatchPhase`, `BotController` with personality / aim / tactics,
`Streak`, `Overheat`, the HUD / lobby / radio models); `nodes/` — Godot nodes that host it (`PlayerNode`
CharacterBody3D, `MatchNode` coordinator, `Hud`, menus, lobby, radio UI, trailer); `scenes/` — `main_menu.tscn`
(the run scene), `arena_test.tscn` (a match), `trailer.tscn`; `autoloads/` — `SteamBridge`, `Game` (profile, room,
match setup, session log), `Audio` (SFX, menu / trailer music, the analysis hub), `Radio`. Unit tests construct `sim/`
classes directly; nodes are tested in SubViewports.

**Simulation.** A single `Player` — the human, a bot and a remote player alike — composes a `Body`, a beam weapon and a
shield and exposes intent methods with built-in cooldowns; controllers (`HumanController`, `BotController`) drive the
same intents. `MatchNode` runs the rules after the entities each physics frame (60 Hz with physics interpolation):
one-shot kills, shield blocks, the ghost respawn, streaks / bounty / overheat, the `ready → countdown → live → ended`
ritual stamped by the lobby creator. Movement is `CharacterBody3D` with a manual step-up; combat raycasts hit hitboxes
on their own physics layer (teammate bodies block the beam, friendly fire deals no harm).

**Networking — P2P, symmetric full mesh (`sim/net/`).** No host authority: every peer simulates the players it owns
(itself + its bots). `RoomSession` is the seat handshake (HELLO / ASSIGN / READY / SETSLOT / START; the seat index is
the player id, the creator sits in seat 0); `NetSession` + `NetSync` broadcast snapshots of owned players and slim
events; combat is shooter-claimed and **victim-judged** (the shield on the victim's screen wins), with the shooter's
kill predicted and rolled back. Transports: `SteamNet` over Steam relay (lobbies, quick match, invites) and
`LoopbackNet` for solo rooms and tests. The mode (Duel / Battle / War) is a lobby preset; the simulation is always
team-based.

**UI.** Screens live in `MainMenu` (menu, lobby, settings, appearance, about, radio takeover) over a persistent 3D
`MenuBackdrop`; the match overlays are `Hud`, `ReadyOverlay`, `PauseOverlay` (a live match without the pointer lock)
and `MatchEndedOverlay`. Text is laid out like Chrome (`CssTextRun` / `CssLabel` / `CssButton`: fractional letter
spacing and sizes), 10 locales come from `assets/i18n/*.json`, and the interface follows the Windows display scale
fullscreen (`DisplayStartup`, `UiScale`).

**Radio.** The Strudel engine runs in `radio-host/`'s page, served to a 1×1 off-screen godot_wry WebView from
`res://localhost/radio_host/` (`WebViewRadioTransport` → `RadioHost`, JSON messages in `RadioProtocol`); the player,
explorer, code panel, trial and library are native Godot UI (`nodes/radio/`, `sim/radio/`).

**Steam.** GodotSteam GDExtension behind `SteamApi` / `SteamBridge`: achievements, Steam Cloud profile sync, Rich
Presence, lobbies and invites, the Radio DLC check.
