# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OneShot — an arcade first-person shooter. Stack: React 19 + React Three Fiber (@react-three/fiber 9) +
Three.js 0.184 + @react-three/rapier 2 (physics), Trystero (WebRTC P2P), Vite 8 build, TypeScript 6,
Tauri 2 desktop build.

## Base rules

- Communicate with the user in Russian.
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

**Simulation (`src/game/`).** A single `Player` entity — the human, the bot opponent and the remote networked
player alike — composes **injected** `Body` + `IWeapon` (`BeamWeapon`) + `IShield` (`Shield`) (Dependency Inversion).
`Player` exposes intent methods `moveIntent/jump/aim/startFiring/activateShield` with built-in cooldowns. Controllers
(`HumanController` — keyboard/mouse/camera; `BotController` — AI) drive the **same** `Player` methods:
the AI is just another controller, like a keyboard. `Player` **does not respawn itself** — `Match` does.
`Match` owns the world/players/controllers and is the **single place for the rules** (combat, respawn,
HUD events, the ready ritual, excluding self-hits); its `update(dt)` is the shared heartbeat.

**R3F host.** `App` renders `<Canvas>`; `Game` builds the `Match` once (`useMemo`) and spins a single
`useFrame((_, dt) => match.update(Math.min(dt, 0.1)))` (dt is clamped against frame spikes). Each game object
**owns its own THREE meshes**; the world-space visuals (bodies + beams) live in `match.root`, rendered via
`<primitive object={match.root} />`. `Match.update` order: `syncFromBody` → `controllers.update`
(intents/aim) → `players.update` (weapon/shield/visuals) → `applyPhysics` → combat/respawn/HUD →
`controllers.lateUpdate` (the camera reads the fresh position cache).

**Physics — Rapier KinematicCharacterController.** `<Physics timeStep="vary" interpolate={false}>` in `Game`.
Per player — a `<RigidBody type="kinematicPosition">` **with only a `<CapsuleCollider>`** (physics). **Visuals are
decoupled from the RigidBody:** `bodyGroup` is NOT placed inside the `<RigidBody>` (otherwise the hitbox gets a
double transform) — it lives in `match.root` and is positioned from `rb.translation()` in `Player.syncFromBody`.
Movement is one shared KCC: `Body` accumulates intent (`desired`/`velocityY`), `Match.applyPhysics` (inline in
`update`) calls `computeColliderMovement` → `setNextKinematicTranslation`. Gravity/jump are computed by us (a
kinematic body ignores world `gravity`). `RapierBridge` (via `useRapier`) hands `Match` the physics world. Gotcha:
do **not** enable `enableSnapToGround` (it kills the jump); the arena is static `<CuboidCollider>`s.

**Combat and raycast — on Three.js, not Rapier.** `World.raycast` hits mesh hitboxes with `userData.entityId`;
`excludeEntityIds` excludes the shooter (`[p.id]`) — in strict 1v1 the only "other" entity is the opponent, so
friendly fire is impossible (there are no teams). The capsule collider is for movement only. Meshes that must not
be raycast targets are tagged with `userData.noRaycast` at creation time.

**HUD/menus.** The HUD is a React/DOM overlay on `useGameHUD` (a reducer in `App`); `Match` dispatches HUD actions
to it. Menu/room is a screen state machine in `App` (menu/join/room/game) + hash routing. The room is **strictly
1v1, always p2p**: the code creator = host (`HOST_ID=0`), joining by `#CODE` = client. `RoomSession` holds
`hostEntry` + ONE opponent slot (`opponent`, `OPPONENT_ID=1`) — bot XOR client; a joining human **evicts** the bot,
and START is blocked without an opponent (`canStart`). Entering a match is a phase ritual `ready → countdown → live`
(split-screen READY + 3s countdown, movement/actions frozen except the camera; the bot opponent is auto-ready); the
phase is owned by `Match`. For e2e — debug globals
`__debugCamera/__debugTargetHitCount/__debugBotPos/__debugRole/__debugPlayerPos/__debugPhase/__debugReady/__debugForceLive/__debugLeave`.

**Networking — P2P, host-authoritative (`src/net/`).** There is no single-player; a match is always host + one
opponent. `Match` receives a `role` (`host|client`): the **host** authoritatively simulates both (its own human +
the bot opponent `BotController` OR a remote human `RemoteInputController`) and sends **snapshots** (position/visual
flags) + **events** (`fired/kill/block/respawn/scores`); the **client** predicts only its own player (KCC locally)
and renders remotes from snapshots with interpolation (`updateRemote`, without running their combat). Layers: `INet`
— transport (`TrysteroNet` internet / `BroadcastChannelNet` tabs+e2e / `LoopbackNet` units; chosen by
`createNet`/`?net`), `protocol.ts` — JSON messages + roster, `NetSession` — orchestrator (`afterUpdate` after
`match.update`), `intentsFromInput` — the host applies the client's `InputFrame` via the same intent methods (DRY via
`controllers/movement.ts`). Combat is computed **only** by the host (raycast in its world) — the client is not
trusted for hits. The TURN hook is `NET_ICE_SERVERS` (empty = STUN). Gotchas: action names ≤12 bytes; snapshots are
throttled by `NET_SNAPSHOT_HZ`.

**Test strategy.** Rapier (WASM) and the r3f renderer don't run in jsdom → **physics/movement/collisions/in-browser
networking are tested in e2e** (`tests/*.spec.ts`, real Chromium; `multiplayer.spec` — two pages over
BroadcastChannel). Unit tests (`tests/unit/*.test.ts`) hold the pure logic: classes are constructed directly,
`Match.applyPhysics` without Rapier is a no-op, and the network layer is tested via `LoopbackNet` (host↔client in-process).
