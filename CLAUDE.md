# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OneShot — an arcade first-person shooter. Stack: React 19 + React Three Fiber (@react-three/fiber 9) +
Three.js 0.184 + @react-three/rapier 2 (physics), Trystero (WebRTC P2P), Vite 8 build, TypeScript 6,
Tauri 2 desktop build.

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
- After every change, run the tests in headless mode (`npm run test`) and keep the tests up to date with your changes.
- After changes, do a THOUGHTFUL review of your own code so it doesn't snowball into a mass refactor.
- You MUST follow the SOLID, DRY and SRP principles.
- You NEVER use magic numbers. Only named constants.
- Constants must be local.
  - Constants used in a single file — declare them there.
  - Constants used within a single directory — declare them at the directory level.
  - Constants needed project-wide — in src/constants.
  - For constants this is a recommendation, not a requirement. Use common sense.
- When working on the frontend, watch CAREFULLY that the UI doesn't "jump".
  - Button sizes must not change between states.
  - Headings must stay in the same place.
  - Element positions should barely change.
- Don't run the app yourself.
  - The user usually already has it running.

## Tests
- No test may be flaky.
- If a test simply cannot be stabilised — ask the user whether it can be dropped.
- Don't run the tests until the user has confirmed the changes are correct.
  - First ask the user whether it matches expectations.
  - Then run the tests.

## GitFlow
- Develop in a separate feature branch.
  - The feature branch is merged locally into the release branch.
  - A feature branch must be cut ONLY from the release branch.
    - If no release branch existed at branching time — create one.
  - The release branch is named "release_{version}".
  - A release branch must be cut ONLY from ACTUAL master branch
  - Confirm the version with the user before creating the release branch.
  - Nothing needs to be pushed: the user pushes the release branch and merges into master themselves.
- The version in package.json on the release branch must reflect the release branch version.
- Update CHANGELOG.md before merging into the release branch.

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173).
- `npm run build` — `tsc -b && vite build` (full type-check + production build).
- `npm run lint` — ESLint.
- `npm run test` — the **canonical run**: vitest (unit) + Playwright headless (e2e). Run after changes.
- `npm run test:unit` / `test:e2e` / `test:headed` / `test:connected` — individually
  (`test:connected` uses an already-open browser window).
- A single unit test: `npx vitest run --config vitest.config.ts tests/unit/Shield.test.ts` (or `-t "name"`).
- A single e2e: `npx playwright test --project=headless tests/shooting.spec.ts` (or `-g "substring"`).
- Types only, no build: `npx tsc -b --noEmit`.
- Tauri: `npm run tauri:dev`, `npm run tauri:build`.

Note on types: `erasableSyntaxOnly` is on — parameter properties (`constructor(private x)`), enums and
namespaces are **forbidden**. Declare fields explicitly and assign them in the constructor body.

## Architecture (big picture)

Three layers: **simulation — pure TS classes in `src/game/` (no React); R3F — a thin host; HUD — a React/DOM overlay.**

The map of `src/` (the shooter is only about half of it): `game/` — the simulation; `net/` — P2P mesh + room;
`components/` + `screens/` + `ui/` + `hooks/` — React (HUD, menus, lobby, the 3D menu backdrop); `editor/` — the
in-app map editor at `#editor` (dev-only: it reads/writes `src/maps/<id>/` through a Vite dev-bridge plugin, so it is
NOT driven by the map registry in `game/maps.ts`); `maps/` — maps as data (`raw.json` source + `geo.json` compiled
geometry + `preview.png`, per map); `radio/` — the generative radio (Strudel-based; a large, self-contained
subsystem); `steam/` — Steam integration (achievements, cloud, lobby/invites, rich presence) behind Tauri;
`i18n/` — 10 locales typed as `Dict = typeof en`; `diag/` — session logging; `trailer/` — the demo/trailer recorder.

**Simulation (`src/game/`).** A single `Player` entity — the human, a bot and a remote networked
player alike — composes an **injected** `Body` + `IWeapon` (`BeamWeapon`) + `IShield` (`Shield`); weapon and shield
are injected behind interfaces (Dependency Inversion), `Body` as the concrete class (a player IS its body).
`Player` exposes intent methods `moveIntent/jump/aim/startFiring/activateShield` with built-in cooldowns. Controllers
(`HumanController` — keyboard/mouse/camera; `BotController` — AI) drive the **same** `Player` methods:
the AI is just another controller, like a keyboard. `Player` **does not respawn itself** — `Match` does.
`Match` owns the world/players/controllers and is the **single place for the rules** (combat, respawn,
HUD events, the ready ritual, excluding self-hits); its `update(dt)` is the shared heartbeat.

**R3F host — fixed 60Hz tick.** `App` renders `<Canvas>`; `Game` builds the `Match` once (`useMemo`) and drives it
through a `TickDriver` accumulator: one `useFrame` turns the variable render dt into whole `FIXED_DT` ticks (spikes
clamped, catch-up capped). Per tick — `match.update(FIXED_DT)` → `match.step(FIXED_DT)` (manual Rapier step, see
Physics) → `match.captureTick()` → `session.afterUpdate()` (net send). After the loop, `match.renderInterpolate(alpha)`
places visuals + camera between ticks, so rendering stays smooth at any refresh rate. There is **no shared clock** —
every peer ticks its own sim. Each game object **owns its own THREE meshes**; the world-space visuals (bodies + beams)
live in `match.root`, rendered via `<primitive object={match.root} />`. `Match.update` order: `syncFromBody` →
`controllers.update` (intents/aim) → `players.update` (weapon/shield/visuals) → `applyPhysics` → combat/respawn/HUD →
`controllers.lateUpdate` (the camera reads the fresh position cache).

**Physics — Rapier KinematicCharacterController.** `<Physics paused timeStep={FIXED_DT} interpolate={false}>` in
`Game` — **paused**: the world is stepped by hand from the tick loop (`match.step`), not by r3f.
Per player — a `<RigidBody type="kinematicPosition">` **with only a `<CapsuleCollider>`** (physics). **Visuals are
decoupled from the RigidBody:** `bodyGroup` is NOT placed inside the `<RigidBody>` (otherwise the hitbox gets a
double transform) — it lives in `match.root` and is positioned from `rb.translation()` in `Player.syncFromBody`.
Movement is one shared KCC: `Body` accumulates intent (`desired`/`velocityY`), `Match.applyPhysics` (inline in
`update`) calls `computeColliderMovement` → `setNextKinematicTranslation`. Gravity/jump are computed by us (a
kinematic body ignores world `gravity`). `RapierBridge` (via `useRapier`) hands `Match` the physics world. Gotcha:
do **not** enable `enableSnapToGround` (it kills the jump); the arena is static `<CuboidCollider>`s.

**Combat and raycast — on Three.js, not Rapier.** `World.raycast` hits mesh hitboxes with `userData.entityId`;
`excludeEntityIds` excludes only the shooter itself (`[p.id]`) — **teammate bodies DO block the beam** (that's the
tactic), but friendly fire deals no harm: the gate is `shooter.team === victim.team` in `resolveHit`/`judgeClaim`,
not the raycast. The capsule collider is for movement only. Meshes that must not be raycast targets are tagged with
`userData.noRaycast` at creation time.

**HUD/menus.** The HUD is a React/DOM overlay on `useGameHUD` (a reducer in `App`); `Match` dispatches HUD actions
to it. Screens are a state machine in `App` (`menu|lobby|game|settings|appearance|about|trailer|radio`) + hash
routing. The room is **seat-based, always p2p**. The mode (`src/game/modes.ts`) is a **lobby preset** — it fixes the
seat count (1v1→2, 2v2/ffa→4), the team layout (`teamOfSlot`) and the start gate (`canStartFor`); **the simulation
itself is always team-based and never branches on the mode**. The seat index IS the player id, and the lobby creator
always sits in seat 0. Humans take the first free seat via `HELLO → ASSIGN`; there is **NO bot eviction** — the host
manages seats explicitly (`addBot`/`removeBot`) and a client may move to a free seat via `setSlot` (that's the 2v2
team change). Entering a match is a phase ritual `ready → countdown → live` (split-screen READY + 3s countdown,
movement/actions frozen except the camera; bots are auto-ready); the phase is owned by `Match` and stamped by the
lobby creator. For e2e — ~20 debug globals; the full, authoritative list with signatures is `src/debug-globals.d.ts`
(don't duplicate it here — it rots).

**Networking — P2P, symmetric full mesh (`src/net/`).** There is no single-player and **no host authority**: every
peer runs the same `NetSession` and simulates the players it **owns** (itself + its bots). Ownership is the core
idea — *every fact has exactly one owner*: `Match` gets `owners` (id → peer) + `selfPeer` from the room and derives
`ownedIds`; absent owners → the local peer owns everyone (bot matches, unit tests).

Each peer broadcasts only its OWN facts: **snapshots** of its owned players (throttled to `NET_SNAPSHOT_HZ`) +
**events** (`fired/kill/block/respawn/ready/…`). Combat is **shooter-authoritative, victim-judged**: the shooter
raycasts what it sees and sends a `HitClaim` ADDRESSED to the **victim's owner**, who judges it against the victim's
real local state (alive / not a ghost / not a teammate / **the shield on the VICTIM'S screen always wins**) and
broadcasts the verdict. A dropped claim needs no reply — the shooter's predicted kill self-corrects from snapshots
after `NET_PREDICT_KILL_MS`. Scores, streaks and bounty are **derived locally by every peer** from the same slim
event stream — there is nothing to desync. The lobby creator is the only arbiter of the phase (`iAmCreator`/
`creatorPeer`; other peers' phase stamps are dropped).

Layers: `INet` — transport (`TrysteroNet` internet / `SteamNet` Steam relay / `BroadcastChannelNet` tabs+e2e /
`LagNet` — a lag/jitter wrapper for `?net=bc-lag` / `LoopbackNet` units, N peers via `createLoopbackHub`; chosen by
`createNet`/`?net`), `protocol.ts` — JSON messages + roster (tags: `hello/assign/start/snapshot/event/ready/phase/
hit/setSlot`), `RoomSession` — the seat handshake, `NetSession` — the mesh orchestrator (`afterUpdate` per tick).
The TURN hook is `NET_ICE_SERVERS` (empty = STUN). Gotchas: action names ≤12 bytes; a peer leaving mid-match does
**not** end it while two teams remain (its bots leave with it).

**Test strategy.** Rapier (WASM) and the r3f renderer don't run in jsdom → **physics/movement/collisions/in-browser
networking are tested in e2e** (`tests/*.spec.ts`, real Chromium; `multiplayer.spec` — two pages, `mesh.spec` — three,
over BroadcastChannel). Unit tests (`tests/unit/*.test.ts`) hold the pure logic: classes are constructed directly,
`Match.applyPhysics` without Rapier is a no-op, and the network layer is tested via `LoopbackNet`
(`createLoopbackHub` — N peers in-process).

`tests/` has **its own tsconfig** (`tsconfig.test.json`, referenced from `tsconfig.json`), so `tsc -b` type-checks it
too. Keep it that way: vitest runs through esbuild transpile-only, so a test outside the type-check silently rots —
that is exactly how tests ended up referencing protocol fields that no longer existed.
