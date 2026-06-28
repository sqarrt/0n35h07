# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.1]

### Fixed
- **Multiplayer: playable as the client again.** Two networking bugs (both invisible on the ~0-latency test
  transport, hence not caught earlier): client prediction reconciliation **compounded** authority corrections
  across the in-flight input window (overshoot → flung off the map, jerking camera); and the host **collapsed each
  batch of received input frames to the newest**, dropping the in-between movement so its authority lagged and the
  client was constantly **pulled backwards** (rubber-band). Corrections are now rebased, and the host replays every
  input frame with the dt the client sent — frame-rate independent.
- **Radio: the volume slider can be dragged again.** "Drag the player from any empty area to save" had hijacked
  mousedowns on the slider/buttons; controls now keep their native behaviour.

## [0.6.0] - 2026-06-28

### Added
- **Radio is a paid DLC with a free daily trial.** Non-owners get **10 free generations + 5 library saves per day**;
  the DLC unlocks unlimited. Saved tracks always play free. The player shows the remaining daily quota and an
  **"Unlock Radio"** button that opens the Steam store.
- **Radio — a track library you can organise (desktop).** A built-in file explorer over a real folder in the app
  data dir replaces the old favorites list: **drag the playing track (grab anywhere on the player) into a folder to
  save it**, play a single track or a whole folder as a looping playlist, multi-select (Ctrl/Shift-click + rubber-band
  box), and right-click for play / new folder / rename / copy / paste / delete (with F2 / Del / Ctrl-C / Ctrl-V
  shortcuts). The window is draggable, resizable and minimises into a bar over the player or maximises full-screen.
- **Radio — audio-reactive visualizers behind the explorer.** Four modes — oscilloscope, spectrum bars, radial ring,
  particle field — switchable from the window, plus an **AUTO** mode that rotates through them.
- **Radio — a richer, more unique generative palette.** New co-designed **bass** characters (reese wobble, bit-crush,
  chromatic-drift, glitch, acid-pulse, wavetable flute/digital), **drum grooves** (amen breakbeat, industrial, broken,
  minimal), **background textures** (tape-choir, drone-cluster, radio-scanner, tape-warble, insect swarm, funeral bell)
  and **leads** (Silent-Hill fog/rust, virtual chime/data-rain, and procedural random-walk leads). Every track also
  varies its bass and drum character, applies per-track parameter **mutations** (filter / space / drive / groove + a
  few safe melody tweaks) and **disguises its lead and bass riffs** (seeded cell recombination) so no two tracks sound
  alike.

### Changed
- **Radio generation is no longer biased by your likes/dislikes** — the stream is purely varied and your saved tracks
  live in the on-disk library instead. Old favorites migrate to the library automatically on first run.
- Background textures now sit further under the groove (lower ceiling) so they never pierce on exposed intros.
- Some leads/basses that read wrong in the live mix were dropped from the rotation.

## [0.5.11] - unreleased

### Added
- **Radio — a generative music mode (desktop).** An endless stream of dark-techno / acid / industrial / ambient
  tracks composed live, each with its own mood, key, BPM, arrangement and a wide variety of melodic leads.
  Like/dislike tracks: favorites are saved and replay exactly, and your taste steers what's generated next. The
  menu visualizer reacts to the music while it plays.

### Fixed
- **Pointer lock didn't fully engage after pressing "Ready" (the view wouldn't turn until a second click).**
  The lock badge appeared, but mouse movement didn't rotate the camera until you clicked again. `PointerLockControls`
  was mounted inside `<Suspense>`/`<Physics>`, which stays suspended while the Rapier WASM loads — but the READY
  screen (a HUD overlay, independent of the canvas) is already clickable, so the "Ready" click grabbed pointer lock
  before the controls existed. drei never saw that `pointerlockchange`, so its internal `isLocked` stayed false and
  `onMouseMove` early-returned; a later canvas click re-locked through the now-mounted controls and "fixed" it.
  `PointerLockControls` is now mounted eagerly (outside Suspense/Physics — it only needs the camera, not physics),
  so the lock is observed immediately.
- **Severe input lag when playing as the network client** (sticky/viscous walking, character kept
  sliding by inertia after releasing a movement key). The client predicts its own player locally, but
  every frame it was *unconditionally* lerped 15% toward the host's last snapshot — a position a full
  round-trip stale — which injected the network latency straight into the locally-predicted position
  (the camera follows it, so you felt it directly). The host felt fine because it's authoritative.
  This reconciliation existed to fight drift from hard player–player capsule collisions, but those were
  long since replaced by a knockback impulse (KCC ignores player capsules), so the per-frame pull no
  longer fixed anything — it only added lag. Replaced with proper prediction reconciliation: the client
  keeps a `seq → predicted position` history and, on each snapshot, compares the host's authoritative
  position **at the acked input seq** against what it predicted for that same seq. Within a deadzone the
  prediction is trusted (zero correction, zero added latency); only a genuine divergence snaps. Surfaced
  now because e2e runs over `BroadcastChannel` (~0 RTT, where the old pull was harmless) while real Steam
  play has real RTT.
- **The packaged desktop/Steam build couldn't start without the Vite dev server** (showed
  `localhost refused to connect` / `ERR_CONNECTION_REFUSED`). The local depot build
  (`scripts/build-steam.mjs`) ran a plain `cargo build --release`, which — unlike `tauri build` —
  left the `tauri` crate in dev mode (`dev = !custom-protocol`), so the exe loaded `devUrl`
  (`http://localhost:5173`) instead of the embedded frontend. The build now enables the
  `custom-protocol` feature (declared in `src-tauri/Cargo.toml`), producing a self-contained exe.
- **Epilepsy warning missing on the desktop/Steam build.** The photosensitivity warning was accidentally
  gated to the web build (it got bundled with the "hide WebRTC UI on Steam" change). It now shows on all
  builds again — desktop, Steam and web (still skipped only under `?net=bc` e2e).
- **Toggling the in-match outline post-FX teleported the player.** The setting was threaded as a prop
  through the Canvas, so toggling it re-rendered the game subtree and re-applied the player RigidBody's
  spawn position (and reset the camera). It's now driven by a small external store that re-renders only
  the arena outline — no Canvas/Game re-render, no teleport.

### Internal
- **CI: dropped the desktop build.** The Tauri desktop installers are no longer built in CI — the Steam
  build is produced locally (`npm run build:steam`) and the web version ships via `deploy-pages`. A version
  tag now publishes a **notes-only** GitHub Release (the tag message); the Steam SteamPipe CI was already
  removed in 0.5.10.

## [0.5.10] - 2026-06-23

### Added
- **Steam achievements.** In-game events now unlock Steam achievements through the existing JS↔Rust
  bridge: first blood (CATALYST), Double / Triple / Singularity kill streaks, a perfect block, the first
  win and a flawless (no-death) win. Achievements fire for the local player only and are de-duplicated per
  session. Off-Steam (browser / Tauri without Steam / unit tests) the whole path is a silent no-op.
- **Steam Cloud saves.** The player profile (name, colors, cosmetics, audio levels, preferences) now syncs
  across machines through Steam Cloud: on launch the desktop build reconciles the local profile with the
  cloud copy (last-write-wins), and every settings change is uploaded. Boot is never blocked (a short read
  timeout) and off-Steam nothing changes — local settings behave exactly as before.
- **Steam Rich Presence.** The desktop build now reports a status to the Steam friends list — *In menu*,
  *In lobby* or *In a match* — following the current screen. Off-Steam it's a silent no-op. (The status
  text comes from Rich Presence localization tokens defined in the Steamworks partner portal.)
- **Procedural music variety.** Menu and match music now vary over time: a lead can be doubled into a
  stereo-spread copy (loudness-matched, so it reads as width, not volume), and loops occasionally get a
  reverb wash or a lead echo. In a match the choices are seeded from the room code, so both peers hear the
  same thing. Effects respect the music-volume slider and fade with the music; the kick stays dry.
- **Editor: hold-to-repeat placement.** Holding the left or right mouse button in the map editor now
  auto-repeats place/remove at the crosshair (like rapid clicking).
- **In-match settings.** The pause menu now has a **Settings** entry with Sound and Graphics, applied
  live without leaving the match — including the block-outline post-FX (previously fixed only at match
  start). The shared sound/graphics controls back both this and the full Settings screen.

### Changed
- **"About" moved to the main menu.** The game/developer info (and the Watch-trailer button) is now its
  own **About** screen opened from the main menu, instead of a tab inside Settings.
- **Steam build hides the Trystero/relay UI.** The desktop (Steam) build plays over Steam Datagram Relay
  rather than WebRTC, so the relay-specific bits are now hidden there: the Settings **Network** tab and the
  on-screen connection-status indicator are gone, and relay pre-warming / the "WebRTC may not connect"
  warning no longer run. The browser build is unchanged. (All gated on the single `IS_DESKTOP` flag.)

### Internal
- **Steam networking — transport core (foundation).** A Steam P2P transport (`SteamNet implements
  INet`) over Steam lobbies + NetworkingMessages (SDR, no TURN), plus the Rust lobby/messaging bridge
  (create/join/leave/invite, send, member & join-request events). No effect on the browser build,
  which keeps WebRTC.
- **Steam online play & lobby UX.** The desktop (Steam) build plays online over Steam, never WebRTC,
  so Steam and browser players never meet. "Play with friend" is invite-based with a **single entry
  point**: the empty opponent seat itself is the invite call-to-action — clicking it opens a "Choose a
  friend" modal (search box + scrollable online-friends list); picking one sends the invite and the seat
  switches to a "waiting" state until the friend joins (no room code, no separate panel/buttons).
  Matchmaking is Steam quick-match (public lobbies). The **browser build drops the Matchmaking tab**
  (Steam-only) and keeps the room-code "Play with friend" as before. Verified live (two Steam clients):
  the friend invite → join → match flow works end to end.

### Fixed
- **Pause menu re-grabbed the pointer on any click.** Drei's PointerLockControls bound its click→lock
  to the whole document, so any click in the pause overlay re-captured the pointer and dismissed it
  (which broke the new in-match settings). It's now scoped to the canvas — only Resume re-locks.
- **Doubled perimeter walls on the maps.** Each arena wall was drawn twice (a wall plus an overlapping
  contrasting "trim" strip), causing z-fighting and a doubled shadow. The maps were cleaned up, and the
  editor now drops such stale trim strips on import so the doubled wall can't come back on re-save.
- **No menu music in the map editor.** The background menu music kept playing while editing a map; it is
  now silenced in the editor.
- **Cyrillic UI font.** The UI font (Share Tech Mono) shipped Latin glyphs only, so Cyrillic text fell back
  to a mismatched font. The Cyrillic face is now bundled under the same family (scoped by `unicode-range`),
  so the entire non-Latin UI renders in the intended font — Latin still comes from the existing web font.
- **Steam "Play with friend" seat flicker.** Opening the tab briefly showed the local player in the guest
  seat before snapping to the host seat while the lobby formed; the seat side is now stable from the first
  frame (the intended host/client role is tracked during lobby creation).

## [0.5.9] - 2026-06-22

### Added
- **Steam integration — foundation.** The desktop build now runs as a Steam application: the Steamworks
  SDK initializes (the `steamworks` crate bundles its own SDK), a small JS↔Rust bridge exposes Steam to
  the game (`steam_available` / `steam_user`), and everything degrades gracefully off-Steam — the browser
  build and the unit tests are unaffected. This is the groundwork for Steam matchmaking / achievements /
  cloud saves (each a later piece); there are no in-game Steam features yet.

### Changed
- **Releases are now fully automatic on a version tag.** Pushing an annotated tag (e.g. `0.5.9`) deploys
  the web build to GitHub Pages, builds the desktop installers (`.msi`/`.exe`) into a published GitHub
  Release whose notes are the tag's own message, and uploads the Windows build to a Steam **beta** branch
  (promotion to the default branch stays manual). The site deploy moved from every `master` push to **tag-only**.
- Trailer: the cursor and the SKIP button **hide while watching** and reappear on mouse movement, fading
  out again after a short idle — cleaner cinematic viewing; Escape still exits at any time.
- Branding: window/page titles and the GitHub release name use the stylized **0N35H07**; flowing prose and
  docs keep the readable "OneShot" — the two are the same name ("0N35H07" is leetspeak for "OneShot").

### Fixed
- The Tauri installer version is synced to the release version (`tauri.conf.json` / `Cargo.toml` held a
  stale literal), so the `.msi`/`.exe` no longer ship a wrong version number.

### Internal
- CI: a dedicated `steam-deploy` workflow (on a tag, or the manual "Run workflow" button) builds the
  Windows app and uploads it to SteamPipe; `build.rs` copies the Steam runtime lib (`steam_api64.dll`)
  next to the executable so the app can load it. The downloaded Steamworks SDK is not needed (the crate
  vendors its own) and is gitignored.

## [0.5.8] - 2026-06-21

### Added
- Map editor: white (`#fff`), pink (`#f9c`) and light-blue (`#cdf`) colors added to the block palette.
- Map editor: **cube properties** (a brush applied to the next blocks you place) — opacity
  (opaque/translucent), shoot-through (beam passes through) and walk-through (no collider, you pass
  straight through). Work for both cubes and wedges. Defaults are opaque/non-shoot-through/non-walk-through.
  Host/guest spawns can be placed on top of a block (Y is taken from the surface under the cursor).
- Map `os_pool_day` registered (available in the "Play" menu).
- e2e coverage of block properties (shoot-through/walk-through) on top of runtime registration of test maps
  (DEV hook `__debugRegisterMap`, not shipped in the prod bundle).
- Map editor: **"Cube grid — in game"** setting (`showBlockGrid`) — a map can enable rendering of the
  voxel-cell grid inside the game itself (like the "cube faces" toggled by `L` in the editor). Off by
  default; enabled for map `os_pool_day`.
- Bots get a unique color and skin (orb model + charge/respawn/dash/shield FX), deterministically
  derived from their nickname — by the same seed as the bot's personality (same nick → same look).
- Bots have become noticeably more "human":
  - A single bot **skill** `skill∈[0,1]` is derived from the nick and sets the center of all personality
    parameters; the difficulty ceiling has been raised — the strongest bot is ~3.99× more offensive than
    the weakest (tuned by a single constant `BOT_SKILL_CEILING_RATIO`).
  - **Near-miss misses**: instead of an obvious sideways beam swerve, on a miss the bot aims exactly past
    the edge of the hitbox — the feel of "lucky to have dodged". Stronger bots miss closer and shoot more
    often (personal cadence).
  - **Bunny-hopping** when the bot is ahead on score and under threat: bhop + evasive dashes to "stall out"
    the win.
  - **Baiting your defense**: late in a charge the bot reads your defensive reaction (shield or dash-dodge),
    cancels the shot with a dash — you wasted your defense — and immediately punishes with a real shot.
- Lobby, "Vs. bot" tab: the **bot's name is editable right in its seat** — click the name to type a nick,
  click the seat to reroll a random one. The name deterministically sets the bot's personality and appearance,
  so you can rematch a specific (strong) bot; the slot updates live (name → personality + skin + color). The
  name is never left empty (an empty input reverts to the current name on blur).

### Changed
- The "Play" screen is split into three sub-tabs: **Matchmaking**, **Vs. friend**, **Vs. bot**.
  - **Vs. friend** — a symmetric rendezvous: both players enter the same room code and press SEARCH
    (the host/client role is chosen automatically by the transport); next to the field are random-code and
    copy buttons.
  - **Vs. bot** — a bot is added automatically when you open the tab, with a difficulty selector available.
  - The network-role selector has been removed from the lobby (matchmaking uses the role from the profile;
    forced `client` for symmetric NAT remains in Settings). Tab switching is always available. Tab names are
    localized into all 10 languages.
  - Match settings (map/time) are locked during a search and for a connected client; on the "Vs. friend" tab
    the host can change them live even with a person connected (changes are sent to the client in Assign).

### Fixed
- A bot at the SINGULARITY stage (overheat) now, like a human, sees its opponent through walls and shoots at
  them — previously its LOS check "stopped" at a block and the shoot-through went unused.
- Third-person shooting at a target in a pit/pool (`os_pool_day`): the hit is no longer lost and the beam no
  longer "flies" past. The cause was muzzle↔camera parallax: a human's TP hit is now computed from the aim ray
  (camera→reticle), while the beam visual still comes from the muzzle. First-person behavior is unchanged.

### Internal
- The dev floor-grid in the menu background now shows only while the free-fly camera is held (`J`), instead
  of always in dev — removing a dev-only visual that was absent from the prod build.
- Tests now run in WSL alongside the Windows build: `node_modules` on `/mnt/c` is shared by both OSes, and
  `npm install` installs the native `rolldown` binary only for the current system. Added a self-heal
  `scripts/ensure-native.mjs` (a pre-hook of the test scripts): before running tests it checks that the
  platform `rolldown` binary loads in a separate process and, if it's missing, installs exactly that one via
  `npm install --no-save` (without touching the lock file or the other OS's binary). On Windows it's an
  instant no-op.

## [0.5.7] - 2026-06-15

### Added
- A hint in the main menu (web version only): "F11 — fullscreen". On desktop the window is fullscreen anyway,
  so the hint isn't shown there. Localized into all 10 languages.
- An "About the game" section in settings: the developer, links (YouTube/Twitch/email) and a WATCH button that
  launches the trailer. Returning from the trailer opens the same settings tab.
- An in-game trailer (from settings): a replay of recorded bot matches using the real game classes
  (countdown → a cut of short fragments → a slow-motion mutual shot in the finale), with transitions/text/music
  and a fading echo at the end. The trailer HUD is always in English (Steam target audience). Documentation —
  `src/components/trailer/README.md`.
- A frozen standalone copy of the trailer in `trailer-dist/` (independent of the rest of the code — game edits
  don't break it), rebuilt by the `npm run build` step (or separately via `npm run build:trailer`).
- A dev tool for recording demos to cut the trailer (F9 in a match) — dev build only; stripped from the prod
  bundle (DCE by `import.meta.env.DEV` + a dynamic import of the recorder).

### Changed
- Network transport is selected only via the URL parameter `?net=` (+ default `trystero`): reading from
  `localStorage('oneshot:net')` was removed so the transport doesn't "stick" between sessions (a stuck `bc`
  made the network indicator disappear). e2e force BroadcastChannel via `?net=bc`.

## [0.5.6] - 2026-06-15

A desktop-build bugfix: the installer was installing version 0.5.0 with the old frontend.

### Fixed
- The desktop build was stuck on the old version (old version in the corner, old reticle position) even after
  an update: the PWA service worker from the previous build persistently cached the frontend in WebView2 and
  served it no matter how many times `dist` was rebuilt. This couldn't be fixed from inside the webview (while
  the old SW controls the page, the new JS doesn't execute). The fix is a native cleanup from Rust on app
  startup (before WebView2 comes up): once, after an update, the `Service Worker` subfolder of the WebView2
  directory is deleted (the SW registration + its cache); `Local Storage` with settings is left untouched.
  Going forward the desktop build doesn't cache via SW at all (`selfDestroying`, detected via
  `vite build --mode tauri` — the `TAURI_ENV_PLATFORM` env signal didn't always arrive, so the mode is set
  explicitly).
- The installer (.msi) version is now pinned explicitly in `tauri.conf.json` (previously `"../package.json"`
  gave an undefined resolve). CI additionally: cleans `release/bundle` before the build (old installers were
  piling up in the `src-tauri/target` cache, and the upload took the first one alphabetically = the oldest),
  takes the newest artifact, and fails if the version in the MSI name doesn't match the tag (a safeguard
  against publishing a wrong version).

### Added
- In addition to the .msi installer, the release ships a portable binary (`...-windows-x64.exe`) — runs without
  installation (requires system WebView2).

## [0.5.5] - 2026-06-15

A CI bugfix: the Windows-binary build (tauri-windows) now runs to completion.

### Fixed
- CI tauri-windows was failing on `cargo --version`: `rustup could not choose a version of cargo... no default
  is configured`. The `.cargo\bin` cache only holds rustup proxies, while the toolchain itself (RUSTUP_HOME)
  isn't cached → on a fresh VM the cached proxy passed the `Get-Command cargo` check, Rust installation was
  skipped, and the proxy failed without a toolchain. Now detection is by `rustup` (not `cargo`) +
  an unconditional `rustup default stable` that installs/pins the toolchain on a fresh VM.

## [0.5.4] - 2026-06-15

A bugfix: the version in the Tauri installer is synced with the release version.

### Fixed
- The version in the Tauri installer (.msi) was stuck on 0.5.0, even though the web build showed the current
  one: `npm version` bumped only package.json, while Tauri reads the version from
  `src-tauri/tauri.conf.json` / `Cargo.toml`. The `version` field in tauri.conf.json now points to
  `../package.json` — the installer auto-syncs with the release version on all future releases
  (Cargo.toml/Cargo.lock pulled along too).

### Changed
- The release description is now taken from the annotated tag's message instead of a hardcoded stub in CI.

## [0.5.3] - 2026-06-14

An online bugfix: connecting with explicitly selected network roles.

### Fixed
- Host and client didn't connect with explicit roles: discovery there is one-directional (the host publishes,
  the client subscribes), and relays that open a WebSocket but don't forward events broke the only delivery
  path (in "both" mode this was masked by two-way search). Relay probing is now functional — a round-trip
  (REQ + publishing an ephemeral event and receiving it back): only relays that actually accept and forward
  events make it into the set.

### Changed
- Network roles in the lobby were simplified to "Both" and "Client" (the explicit "Host" role was removed):
  explicit-host gave a fragile one-directional search. "Both" hosts and searches at the same time; a saved old
  "Host" role migrates to "Both".

## [0.5.2] - 2026-06-14

A CI bugfix: the Windows-binary build (tauri-windows) now runs to completion.

### Fixed
- CI tauri-windows: the runner had Node 21 (non-LTS, unsupported by vite 8/rolldown/vitest) and was missing
  cargo-tauri → `cargo tauri build` failed with "'no such command: tauri'". The job now installs a portable
  Node 22 and cargo-tauri (cached in `.cargo/bin`). Added `engines` to package.json.

## [0.5.1] - 2026-06-14

A bugfix release: online connection via TURN, fixes for matchmaking and the client's reticle, UI scrolling,
a green Windows CI build.

### Fixed
- Online connection behind symmetric NAT / on networks that block UDP: added a TURN relay (creds from env, not
  in the repo) + restored a public STUN alongside — the direct path (srflx) is found quickly, the relay as a
  fallback. Previously peers found each other but the WebRTC channel didn't open.
- Finding an opponent with explicitly selected network roles: discovery (Nostr) filtered events by the local
  clock — clock skew between machines was cutting off the host's announcements. Added a margin for clock skew.
- Matchmaking: after finding an opponent the default map was loaded and the time showed NaN/00:00 — the client
  joined with a stale selection; now the actually selected map/duration are passed.
- The third-person client didn't register hits: the host built the aim ray from the "eyes", ignoring the
  behind-the-back camera offset. The InputFrame now carries the client's aim origin.
- Scrolling on all screens (previously "Settings" was clipped) + a single themed scrollbar instead of the
  system one on the "Appearance" screen.
- The Windows CI build (tauri-windows): cargo wasn't getting into PATH after installation — the job failed with
  "'cargo' is not recognized". The path to .cargo\bin is added before the check and the build.

### Added
- Dev diagnostics for the P2P connection (`window.__netReport()`): localizes the connection failure layer
  (signaling/ICE/NAT/handshake/discovery). Dev build only.

## [0.5.0] - 2026-06-14

Serverless matchmaking and a new lobby, kill-streak combat mechanics, localization into 10 languages,
orb coloring, and the game renamed to 0N35H07.

### Added
- Serverless matchmaking: a single PLAY button → lobby, P2P opponent search by buckets (map×time) with no
  backend; BOTH mode hosts and searches at the same time. Matchmaking pools are split by game version and
  platform (desktop/browser).
- Kill-streak combat mechanics: streak announcements (DOUBLE / TRIPLE / SINGULARITY + CATALYST), a comeback
  overheat (speed and cooldowns grow, at ×5 — a beam shoot-through walls) and a perfect block (a shield within
  a 100 ms window resets all cooldowns).
- Dash accounts for look pitch — you can dash upward or diagonally.
- Orb coloring in "Appearance": two 16×16 fields (front/back), the drawing maps onto the orb in real time and
  is visible to the opponent in a match.
- UI localization into 10 languages (selectable in settings, system language by default).

### Changed
- Match-end screen: instead of a k/d table — a HUD score smoothly growing into the center of the screen.
- The bot opponent fights exactly like a human (a single combat profile); player collision is a sharp 3D
  knockback instead of sticking; factory model designations (RA9, T-2000) instead of nicknames.
- The game was renamed to 0N35H07.
- Performance and polish: GC stutters and shader recompilation in a match were eliminated; the UI behaves
  "like a game, not a web page".
- Zero GC allocations in the hot path: scratch vectors in all game objects and controllers
  (Player, HumanController, BotController, BeamWeapon, ClassicBeamFx, Body, Match); pre-allocated
  SFX/snapshot buffers; consumeDesired without clone.
- Bundle: Rolldown code splitting (three/r3f/react/vendor); map geo.json is loaded lazily —
  the index chunk shrank from 2.3 MB to 391 KB (−83%); @tauri-apps/api excluded from the web build.

## [0.4.0] - 2026-06-10

Customization: an "Appearance" screen with shot, respawn, dash and shield styles; the lobby became a room.

### Added
- An "APPEARANCE" screen — separate from settings: a live 3D preview on the real game model and selection of
  all cosmetic styles. The selection is stored in the profile and passed via the room protocol — the opponent
  sees your skins in a match.
- Shot styles (charge + beam): IMPULSE, FURY (glitch jaws, a ragged segmented beam), SINGULARITY (a collapse
  with an accretion vortex, a gravitational spiral thread). Each has its own charge sound; click to preview — a
  one-off "charge → shot" run.
- Respawn styles: ECHO (a ghost), SWARM (assembly from a swarm of shards), CHAOS (glitch noise and flicker).
  Preview in "Appearance": death → an orbital fly-around of the ghost → assembly.
- Dash trail skins: TRAIL, WAVE (shockwave rings along the path), RUPTURE.
- Shield skins: DOME, HONEYCOMB (hexagonal tiles that flash on activation), CRYSTAL (a faceted icosahedron
  shell).
- The game version is shown on all menu screens.
- An "EXIT" button to quit the game in the main menu and pause (desktop only).
- A photosensitivity warning when entering the game.
- An app icon/logo and a desktop build (Tauri).

### Changed
- LOBBY renamed to ROOM throughout the UI.
- Cosmetics moved from settings to the "Appearance" screen; only configuration remains in settings.
- The menu background is an "honest" 3D scene: the models stand on real game points, the frame is built by the
  camera alone (poses are in JSON, dev fly-around via J); the room client has its own camera angle.
- The HUD is hidden during the countdown before a fight.
- Faster entry into a fight: a warm-up on entry and BVH-accelerated raycast; a prod Tauri build.
- Tag-based deploy runs automatically (no manual button in CI).

### Fixed
- Jitter of the player capsule against impassable blocks and tilt of the model from aiming.
- The local player's planet ring is colored in the "second" color — as in the menu.
- The cooldown timer of the "CONTINUE" button is identical on desktop and in the browser.
- Main-menu buttons were brought to a uniform width; the "ROOM" title is centered.

## [0.3.0] - 2026-06-09

Sound: procedural music in matches and the menu, spatial effects, reactive visualization.

### Added
- Procedural match music: a deterministic composition of layered stems (seed = lobby code, both players hear
  the same track), with song form — an intro → body → outro arc, section changes as the fight progresses, a
  "resting" bass and ornamental leads, and a fading echo at the end of the match.
- Main-menu music: a calm loop with a smooth fade-in and preloading; a separate volume slider.
- Spatial sound effects on three.js: combat (beam shot, shield block, death, respawn), movement (landing, dash,
  shield, cooldowns), the "go" countdown on entering a fight, and UI sounds (toggles, ready, lobby). Your own
  sounds are 2D, others' are positional.
- A "SOUND" section in settings: volume sliders (master, effects, match music, menu music).
- Sound visualization in the menu: a soft glow on the visible edges of the 3D models, pulsing with the music
  volume (in the model's on-screen color); no glow in silence. Toggled off via the "MENU GLOW" checkbox.
- A sound visualizer in a match: a frequency-spectrum line at the bottom of the screen. Toggled off via the
  "SOUND VISUALIZATION" checkbox.
- The planet-model ring reactively changes color with the sound and uses the player's "second" color.
- The lobby connection timeout was moved to settings (5 / 10 / 20 / 30 / 60 / 90 / 120 s, default 10).

### Changed
- Default volumes: effects 100%, match and menu music — 30%.
- The "Highlight outlines" setting renamed to "Highlight block outlines".
- Jumping is no longer sounded — only landing.

### Fixed
- Cleaner effect sound: de-click envelopes on one-shots, an equalpower pan instead of HRTF, throttling of
  movement sounds during bhop — crackle, "quack" and "fart" removed.
- The music scheduler doesn't drop the loop into silence on a main-thread hitch (a scheduling buffer) and
  doesn't dump overdue loops after a long time in the background — no "mush" or abrupt cutoffs.
- "COPIED" in the lobby is centered on the code button.
- The respawn indication doesn't leak into the next match (reset on restart).
- Entering the menu no longer "jitters": the heavy glow composer mounts deferred (after the model appears), its
  compilation doesn't freeze the main thread; the model fades in smoothly.
- The FPS drop at the start of a fight was eliminated: the music stems are decoded ahead of time (during the
  ready ritual) rather than at the moment of entering live.

## [0.2.1] - 2026-06-04

Network connection reliability and a fair bot spawn.

### Added
- A network-status indicator in the corner of the pre-game screens: shows the progress of probing signaling
  relays and the size of the working set.
- A "NETWORK · RELAYS" section in settings: the full list of relays sorted by "health" (alive → dead), with
  latency, and a re-check button.
- Granular states on the lobby-entry screen: "searching for lobby" → "lobby found, connecting" →
  "lobby not found" / "failed to connect".

### Fixed
- Lobby connection: instead of a fixed (by appId hash, often unavailable) set of five public Nostr relays —
  probing their liveness on entering the menu and using only the confirmed set (self-healing, a cache with TTL,
  a curated fallback). Eliminates cases where the opponent isn't found.
- The bot opponent spawns mirrored to the player (deterministically, across the arena) rather than at a random
  point.

## [0.2.0] - 2026-06-04

A full redesign of the menu and HUD + a timed match mode.

### Added
- A unified UI kit: the monospace Share Tech Mono font, flat "hard" buttons with instant feedback
  (hover/press), design tokens and a theme.
- Large "live" 3D player models on the background of the main menu, lobby entry and settings; the model moves
  sharply (~200 ms) but smoothly between positions on a screen change and appears via a fade.
- A VS layout for the lobby: host and opponent on either side, a large match code, copy-on-click for the code.
- A timed match mode: the host picks a duration of 3 / 5 / 10 minutes in the lobby; the match ends on time
  expiry or when the opponent disconnects.
- A match-result screen: VICTORY / DEFEAT / DRAW with the reason for ending and the final score.
- A persistent HUD block with the score and timer (MM:SS format) and player names — no need to hold Tab.
- A lobby-entry screen: connection indication (a running border around the code field) and an error message on
  timeout.
- A ready screen: enter the fight by clicking anywhere, highlighting of the players' sides, a control legend.
- A single rectangular outline for the combat HUD: the shield's corner brackets, the dash's side bars and the
  respawn bars on a common perimeter line.

### Changed
- All screens (main menu, lobby entry, lobby, settings, pause, ready, match result) were moved to the new
  visual language.
- Lobby: a VS view instead of a player table; the local player's nick is underlined instead of being marked
  "(you)".
- Settings: a 3D model on the left as a live preview of the chosen color/model, the parameters panel on the
  right.
- The "CONTINUE" button in the pause menu: the cooldown is shown by the button's fill, and the size no longer
  "jumps".
- Menu/lobby/entry panels are a fixed size, not changing their dimensions on screen switches.

### Removed
- The Tab scoreboard and the kill feed — the score is now always visible in the HUD.
- Dead code from the Vite starter template (App.css) and unused components/styles.

### Fixed
- Menu and lobby layout stability: "jumps" on adding a bot, state changes and text changes were eliminated, HUD
  elements aligned.
- Multiplayer e2e test reliability: Chromium background-tab throttling was disabled (the P2P handshake no
  longer flakes under load).

## [0.0.1a] - alpha

Base alpha: the core of the arcade 1v1 shooter (movement/jump/dash, beam and shield, bots, P2P lobby, arena).

[0.5.0]: https://github.com/sqarrt/0n35h07/compare/0.4.0...0.5.0
[0.4.0]: https://github.com/sqarrt/0n35h07/compare/0.3.0...0.4.0
[0.3.0]: https://github.com/sqarrt/0n35h07/compare/0.2.1...0.3.0
[0.2.1]: https://github.com/sqarrt/0n35h07/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/sqarrt/0n35h07/compare/0.0.1a...0.2.0
[0.0.1a]: https://github.com/sqarrt/0n35h07/releases/tag/0.0.1a
