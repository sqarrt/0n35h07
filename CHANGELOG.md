# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] - Unreleased

### Changed
- **The game is being rewritten natively on Godot 4.7.** The repository root is now the Godot project; the
  React/Three.js game lives in `web-reference/` as the 1:1 parity oracle until the port catches up.
- **Controls match the original.** The shield is on the right mouse button; a shot fires once per click instead of
  repeating while the button is held; aiming follows what the camera actually looks at.
- **Pausing no longer freezes the match.** As in the original, the pause menu opens whenever a live match loses the
  mouse (Esc or switching windows), the match keeps running behind it and the HUD steps aside.
- **The pre-fight countdown number matches the original's weight.** It was drawn bolder and a few pixels high; it now
  uses the browser's synthetic bold and line box.
- **Bold text keeps the original's letter widths.** Large bold lines (titles, the trailer's text cuts) came out wider
  than in the original; the extra width is now taken out of the letter spacing.
- **The game starts fullscreen at the Windows display scale.** As in the original's desktop build, the window fills the
  screen and the interface follows the Windows scale setting (150% draws it half again as large), so menus, the lobby
  and the HUD look the same fullscreen as in a small window; 3D backdrops and streak text render at full resolution.
- **Letters sit where the original puts them.** Labels and buttons on the menu, settings, about and lobby screens,
  the pause menu, the match-end screen and the ready ritual (names, statuses, hint and controls legend), the glowing
  logo and mode names, the HUD's names, timer, streak banner and stats overlay, the warning splash, the trailer's
  text cuts, title and SKIP, the Steam invite toast and the text inside input fields (the settings name, the friend
  search, a seated bot's name) were drawn
  with whole-pixel letter spacing and font sizes, so words came out a few pixels too wide or narrow; every letter now
  lands at the original's fractional position, bold text thickens evenly and centred text keeps its exact place, in a
  window and fullscreen.
- **Steam invites reach you anywhere, as in the original.** A friend's "Join game" during a match leaves it for their
  lobby at once instead of waiting for the menu, and an invite that arrives while the trailer plays pops up over it —
  accepting leaves the trailer for the friend's lobby.
- **Buttons no longer answer the keyboard.** As in the original, Tab does not walk the menu buttons and Space or Enter
  never press a button that was just clicked.
- **The radio follows every volume slider.** Master and radio volume changed in SETTINGS or in the pause settings now
  change the radio at once, as in the original, not only the player's own slider.
- **The game builds for Windows in the Steam depot layout.** `scripts/export_windows.ps1` exports `0N35H07.exe` with
  its pack, the Steam and WebView libraries and the radio page into `release/windows`; the window and the executable
  carry the original's icon instead of Godot's.
- **CI checks the Godot game.** The CI workflow runs the GUT suite on Godot 4.7.1 (Linux, headless) and runs the web
  reference's lint, types, unit tests and build inside `web-reference/`; the Pages deploy and Dependabot follow the web
  reference there.
- **Uploading to Steam works with the Godot build.** `scripts/upload_steam.ps1` publishes `release/windows` to SteamPipe
  with the same options as the web build's uploader (app, depot, branch, login, description), for the main app and
  the Playtest app, and can write the build scripts without uploading (`-DryRun`).
- **The radio's controls answer the mouse again.** Its buttons — the transport, ON AIR, the ball toggle, the BACK /
  LIBRARY / PROGRAM bars, Unlock and the library's visualizer switch — light up under the pointer and shrink on a
  press, as the original's did.
- **Your ball faces where you look.** The model turned twice with the camera, so the planet appeared to spin the wrong
  way as you swung the aim; it now holds the direction you are looking, as in the original.
- **Stepping up feels like the original again.** The climb happens as part of the step forward instead of after the
  bump, so you keep your speed over kerbs and stairs; a ledge is only taken when there is room to stand on it and the
  surface is not too steep, and a wall taller than the step height is never climbed.
- **The web version is retired from the repository.** The Godot game has replaced the React/Three.js game, which served as
  its parity reference; the web code, its tests, browser tooling and the GitHub Pages deploy are gone (the git history
  keeps them). The radio's engine page, which the game still runs, now lives in its own `radio-host/` package with its
  tests; CI checks it and that the bundled page is up to date.
- **The match HUD bars line up with the original.** The top bar and the team panes add up fractional widths like the
  original's flex rows instead of rounding each item up, the timer frame counts its borders, and an empty streak-dot
  slot no longer takes a pixel, so names, frags and totals sit where the original has them.
- **Scroll bars match the original's desktop build.** Scrolling screens keep the room of its thin native scroll bar,
  with arrow buttons and a narrow round-ended thumb, so the lobby's column lines up with the original; the ✕ buttons
  on seats and in the friend picker keep their small line height.

### Added
- **The map editor is back, as a tool of its own.** The original's editor now runs as a small local web app
  (`map-editor/`, `npm run dev`) that writes the game's own map files in place — the map, its compiled geometry and
  its preview — so maps can be built and fixed again. It is not part of the game build.
- **The Radio's music engine runs inside the game.** The original's generative Radio engine now runs in an embedded,
  invisible web runtime (the system WebView2) and the game drives it.
- **The RADIO button and the docked Radio player.** The main menu has the original's RADIO entry and, in its corner,
  the glass mini-player with the track name and prev / play-pause / next; it warms the engine up on the menu, dims until
  the engine is ready, remembers whether the Radio is on and keeps the menu music quiet while it plays. Track names are
  the original's, seed for seed. The Radio screen and library come next.
- **The Radio's free daily trial.** As in the original's Steam build, without the Radio DLC the Radio makes 10 new
  tracks a day (the count starts over at local midnight; setting the clock back does not reset it) and then stops;
  owning the DLC — asked of Steam when the menu opens and again when the Steam overlay closes or the game window gets
  focus back — lifts the limit and resumes the stream.
- **The Radio screen.** RADIO or the docked player's track name opens the original's Radio screen: the menu gives way
  to the backdrop and the player glides to the bottom centre and unfolds — tempo and key, a seekable progress bar with
  times, the transport, On Air, a toggle that tilts the camera off your ball, the radio volume, the free-trial strip
  with Unlock Radio (it opens the DLC's store page) and BACK. Symbols the UI font lacks (emoji, arrows, math signs) sit
  on the same line heights as in the original. The code panel, the beat-driven visuals and the library come next.
- **The PROGRAM window.** The Radio screen shows the track's Strudel program in the original's glass window: it wraps
  exactly where the original does, glows softly, scrolls with its thin scrollbar, drags by its title, resizes by its
  corner, maximizes, copies the program on a click ("(copied)" in the title) and minimizes to a PROGRAM bar over the
  player that brings it back.
- **The Radio screen's frosted glow.** On the Radio screen the menu backdrop turns into the original's frosted glass: the
  whole scene blooms softly, brighter with the music, and the ball's edges glow stronger (even with the menu glow
  setting off). The Radio's sound now drives the menu glow on every menu screen, as in the original.
- **The Radio screen dances.** As in the original, the camera punches in on every beat of the track and emoji picked
  by the track's mood rain down from the top of the screen, born on the beat.
- **The LIBRARY window.** The Radio screen opens the original's library explorer beside the player: back / up / home,
  the folder's path, folders and cassettes laid out as in the original, the item and folder counts and the visualizer
  mode switch (remembered). A click selects a track (Ctrl adds, Shift takes a range), a double click opens a folder or
  plays its tracks from that one. Saved tracks live in the game's app data `radio` folder, as in the original. A right
  click opens the original's glass context menu (Play, New folder, Rename, Copy, Paste, Delete) with the same F2, Del,
  Ctrl+C and Ctrl+V shortcuts; names are edited in place, and a click on the path copies it. Tracks drag onto a folder
  (lit with a green dashed outline) to move there, and a rubber band dragged over the empty grid selects what it
  touches. Behind the window the original's music visualizer glows — an oscilloscope, bars, spokes or a drifting dot
  field, AUTO rotating them every 18 seconds, the choice remembered. Playing a library track plays its folder as a
  queue (prev / next step round it, a finished track moves on, On Air returns to the live stream); the track playing
  drags from the player onto a folder to be saved (on the free trial, 5 saves a day); a minimized LIBRARY window
  becomes a bar over the player beside PROGRAM, the one minimized last on top.
- **The Radio plays through a match.** As in the original, a match started while the Radio is playing keeps it as its
  soundtrack instead of the match music (the HUD's audio bar follows it); a match started without it plays its own
  music and stops the Radio, and the trailer always stops it.
- **A diagnostic log per session.** As in the original's Steam build, each run writes a session log (the newest 15 are
  kept) with the room handshake, map and time negotiation, match phases, shots, verdicts, peers leaving and uncaught
  errors; the version chip in the menu opens it in its folder.
- **Steam profile, cloud, achievements and status.** As in the original's Steam build, a first run takes the Steam
  name; the profile follows the Steam account through Steam Cloud (the newest save wins, a different account on the
  same machine gets its own profile); the seven achievements unlock for first blood, double / triple kill,
  singularity, a perfect block, a win and a win without dying (never against a passive bot); and friends see whether
  the player is in the menu, the lobby or a match.
- **Friends and quick match over Steam.** As in the original's desktop build, PLAY hosts a private Steam lobby: a free
  seat offers INVITE A FRIEND next to ADD A BOT, the friend picker lists online friends with a search, and an invited
  friend waits on the seat with a pulsing tag until they sit down or decline. SEARCH looks for a quick match (STOP
  cancels it), a friend's invite slides into the corner with Accept / Decline, and "Join game" from Steam or a launch
  link joins the lobby as a guest; a guest whose lobby closes hosts their own again.
- **The built-in trailer plays from ABOUT → WATCH.** As in the original: a 3-2-1 countdown, text cuts slamming in
  with a neon sweep and a glitch split, recorded matches replayed shot by shot under a cover that lifts once each scene
  is ready, the streak banner carrying across shots, dimmed game sounds, the trailer's own music starting on GO, and the
  closing slow-motion duel — two fighters charge and fire, their beams freeze mid-flight as the camera pulls back and
  the title surfaces. It is always in English; the cursor and SKIP hide after a moment without mouse movement, and SKIP
  or Esc returns to ABOUT.
- **Rooms and matches run on the peer mesh.** As in the original, the Play screen is a room its creator hosts:
  guests take free seats, follow the room and ready up, and the match starts on every peer at once with the same
  seats, map and music. In the match each peer runs its own player and bots, shows the others as their owners send
  them, and a player who leaves drops out (the match ends when one team is left). Joining over Steam comes next.
- **Your own hits land at once in networked matches.** As in the original, a shot that hits an opponent shows their
  death immediately instead of waiting for the opponent's machine to confirm it; if their shield blocked it or the
  hit never arrived, they come back within a quarter of a second and can be hit again.
- **Networked combat is victim-judged over the P2P mesh.** A shot is claimed by the shooter and judged by the
  victim's owner against the victim's real local state — the shield on the victim's screen always wins — and every
  peer derives the same score, streak, bounty and perfect-block reward from the verdict. Claims, verdicts and
  snapshots from peers that do not own the player are ignored.
- **Parity reports.** Each web → Godot parity check produces a standalone HTML report with side-by-side screenshots
  (and a wipe slider for camera-aligned frames), capture conditions, confirmed discrepancies and known limits.
  Web reference frames are captured on a real GPU — software rendering drew the floor grid as stripes.
- **The lobby shows the chosen map behind the spheres.** As in the original, the selected map's preview fills the
  screen blurred and dimmed while the lobby is open, fades in and out with it and crossfades when another map is picked.
- **The ready ritual before every match.** As in the original, a match opens on the ready screen: both sides'
  names with their READY / NOT READY status, the "LMB to start" hint and the controls legend; a click takes the mouse
  and confirms, and the 3-second countdown starts once everyone is ready (bots are ready at once).
- **Settings from the pause menu.** SETTINGS in the pause now opens the original's in-match panel: the sound volumes
  and the graphics switches (block outlines, FPS counter, player speed) change live and are saved; leaving the pause
  brings back its menu.
- **Photosensitivity warning on launch.** As in the original, the game opens on a warning about flashing images over a
  dimly breathing ringed planet; the hint to continue appears once the menu has warmed up, and a left click fades the
  warning away. It shows once per launch, in the chosen language.
- **The interface speaks the original's ten languages.** Menus, lobby, settings, appearance, pause, match results and
  HUD words follow the language picked in Settings (or the system language) and switch the moment a language is
  picked. Chinese draws with Microsoft YaHei and the original's tighter button tracking, buttons grow to fit its taller
  lines, and Russian lines no longer sit a pixel lower than the original's.

- **Matches end on time.** A match now runs for a set length (3 minutes by default, the original lobby's first
  choice) with the time left shown in
  the HUD. When the clock runs out everyone freezes and, after a brief freeze-frame, the result screen shows victory,
  defeat or draw, every player ranked by kills, the reason and an exit back to the main menu. The pause menu no
  longer opens once the match is over.

- **Floor grid, sky and map lighting match the original.** Arenas show the 1 m floor grid, the sky takes the
  original's dark page colour, and the ambient light and shadow-casting sun come from the same place with the same
  strength. Checked by measuring pixels against the original on the same GPU: sky, floor and walls agree within one
  step of 255.

- **Match HUD in the original's style.** The top bar shows both sides' frags around the match timer in the original
  layout and font; the crosshair ring fills as the beam recharges; four corner brackets fill as the shield recharges
  and side bars as the dash recharges. The old bottom cooldown bars and the always-on speed readout are gone, as in the
  original. Positions and colours were checked pixel by pixel against the original.
- **HUD effects from the original.** The countdown dims the arena and pops each big glowing number in; a streak
  banner flickers in under the timer naming the player (any player's streak, as in the original); the screen edges
  glow while charging a shot, while the shield is up (with its faint grid) and during the respawn ghost phase, which
  also shows shrinking bars and a "RESPAWNING" caption; own shots, being hit and blocking tint the screen briefly
  for the original's durations.
- **Block cell grid.** Maps that enable it (Pool) outline every block cell with translucent blue lines, as in the
  original.
- **Kill-streak text effects and soft glows.** The streak banner and the players' names in the top bar take the
  original's streak effects: DOUBLE KILL flickers in the player's colour with electric distortion, TRIPLE KILL
  overdrives, SINGULARITY burns and corrupts its letters, CATALYST throbs with sparks; streak dots count each
  player's run. Every HUD glow — the countdown number, the respawn caption and bars, the result headline — is now a
  soft blur like the original's instead of a hard outline.
- **Third-person view and camera feel.** V switches to the original's over-the-shoulder view (your ball becomes
  visible); your own shot shakes the camera briefly; the field of view widens during the respawn ghost phase like a
  dash. Mouse look uses the original's sensitivity and slows down while charging a shot.
- **Player profiles.** The first launch creates a profile like the original — a generated model-style name and a
  colour pair — and keeps it between sessions. Bots get a fresh model name each match, and the name decides their
  colour and look exactly as in the original. The top bar, the streak banner and the result screen show everyone's
  real name in their own colour, with the streak effect kept on the names at the end of the match.
- **Player balls look like the original.** Each ball takes its player's colour and model (smooth, waves or a planet
  with its ring) and artwork, turns with the player's look, swells and whitens while charging a shot (or chars red /
  collapses for the other windup styles), bursts into particles on death, floats as a translucent ghost with a trail
  and pops back in when it respawns. Your own ball and shield stay hidden in first person, as in the original.
- **Beams in every style.** Your shot fires the original's beam for your windup style — the classic white core in
  your colour with its afterglow, the ragged rage discharge or the dark singularity thread with its spiral — while
  bots fire the classic beam with a red shell. Impact sparks come only from your own hits, as in the original.
- **Shield and dash skins.** Shields take the player's style — the pulsing wireframe dome, the hexagon tiles that
  flash in a wave, or the crystal with a flickering face — and dashes leave the chosen trail: speed clones,
  shockwave rings or a red-green-blue rift.
- **Windup and respawn skins.** Charging a rage shot opens a glitching hologram of jaws in front of the ball that
  snaps shut when you fire; a singularity shot pulls a vortex of sparks into the ball and ends in a white collapse
  flash. Respawns follow the chosen style too — the particle burst and translucent ghost, a jittering glitch ghost
  that reassembles in steps, or a swarm of fragments that orbits you and gathers back into the ball.
- **Overheat works like the original.** A kill streak now speeds you up while lengthening your beam and shield
  cooldowns; once anyone reaches a SINGULARITY streak every beam and aim ray passes through map blocks and the blocks
  turn see-through for everyone. Your screen edges glow red with flickering lightning that grows with your streak.
  Ghosts move twice as fast again, easing back before they respawn, and glass blocks use the original's transparency.
- **Block edges are outlined.** With post-processing on (the default), the visible edges of map blocks are drawn
  lighter, as in the original, including on see-through blocks.
- **The game has sound.** Matches play the original's music, composed from the same room code into the same song form
  of 8-second loops and fading out with an echo when the match ends; the menu has its own music. Players, shots,
  shields, dashes, landings, blocks, kills, respawns, the countdown and streak announces sound as in the original,
  positionally for the opponent. Buttons click and blip on hover. The HUD shows the original's sound visualiser line,
  and every level follows the master / music / effects / menu music volumes of the profile.
- **FPS and speed readouts.** With the profile's FPS / speed options on, the HUD corner under the shield bracket shows
  the frame rate with the slowest frame of the last half second, the frame-time graph with its 120 / 60 FPS guides and
  the player's speed, as in the original.
- **The original's buttons and pause menu.** Buttons take the original's filled, outlined and dim looks that switch
  instantly on hover and press. The pause menu shows MENU with RESUME, SETTINGS, TO MENU and QUIT over the dimmed
  match, and the result screen gets the original's column spacing, a bold headline and the filled EXIT button.
- **The original's main menu.** The game opens on the original's centred menu panel with the glowing 0N35H07 logo,
  PLAY, APPEARANCE, SETTINGS, ABOUT and QUIT, and the version in the corner, which opens the log folder when clicked.
  The map is no longer chosen in the main menu: as in the original, that belongs to the lobby.
- **The lobby.** PLAY opens the original's Play screen: pick Duel, Battle or War, one or several maps from their
  previews (os_test included), and 3, 5 or 10 minutes; seat bots, rename them or roll a new name, and set them to
  normal or passive. READY starts the match on the chosen map for the chosen time: a duel, a Battle of two teams of
  two starting side by side, or a four-player War from spread-out random spots, with every bot hunting its nearest
  enemy. With more than two players the top bar lists everyone's frags on two panes around the timer, with the team
  totals in Battle, and every other player carries a name plate — in their team's colour in Battle, neutral grey in
  War — that disappears while they are dead.
- **The menu stage behind the panel.** The menus now sit over the original's 3D backdrop: your ball stands in the
  scene under a slowly orbiting light, framed by the original's camera poses. In the lobby every seated player
  appears on their seat's spot — the Duel pair or the Battle / War square — fading in when they sit down and shrinking
  away when they leave.
- **The menu glows with the music.** As in the original, the edges of the balls and planet rings on the menu stage
  light up with a soft glow that follows the music (the menu glow setting turns it off), and the menu panel softly
  blurs the scene behind it.
- **Settings and About.** SETTINGS opens the original's settings: your name, the default first- or third-person view
  (a match now starts in it), the language (remembered for when translations arrive), the volume sliders and the
  graphics switches — every change is saved and applied at once. ABOUT shows the developer's links and the trailer
  button. Russian and Chinese text in the interface now takes the same bold and letter spacing as Latin text.
- **Appearance.** APPEARANCE opens the original's cosmetics page: the panel slides to the right and your ball previews
  every change behind it — the primary and reserve colours, the sphere model, artwork painted on its front and back,
  and the shot, respawn, dash-trail and shield styles — with the camera turning to the block you last touched.
  Everything is saved as you go.
- **Style previews.** Clicking a shot, respawn, dash-trail or shield style on the appearance page plays it on your
  ball as in a match — the charge and the beam, a ghost lap and the reassembly, a dash out and back, the shield
  raised — with its sounds and the beam's glow.

### Fixed
- **The charge vignette was always at full strength.** The blue screen-edge glow while charging a shot now builds
  up with the charge and eases like the original; HUD gauges update at the original's pace.
- **Map surfaces were drawn inside out.** Map geometry is authored with the opposite triangle facing, so the game
  drew the back faces of blocks and walls and lit them from the wrong side (the bright and dark perimeter walls were
  swapped). Faces now point the right way, which also makes the beam hit block surfaces from the correct side.
  Edges are antialiased as in the original.
- **Players start on the map's spawn points.** The human and the bot now appear on the map's own start positions
  (slot 0 on the first point, the opponent on the second), instead of a fixed spot and a hard-coded bot position.
- **Map collisions match the original.** Movement collides with the map's compiled collision geometry, the floor and
  tall invisible walls around the arena; the beam hits only what it hits in the original, so it passes over the floor
  and through walls marked as beam-transparent. Passable blocks no longer stop the player.
- **No leftover test target in matches.** The red practice dummy is gone from the match scene.
- **Balls push each other apart again.** As in the original, two players whose spheres overlap get a short shove out
  of each other (and landing on top of someone launches you into an arc) instead of standing inside one another.
- **Stepping up no longer throws you into the air.** The automatic step now fires only against obstacles the player
  cannot walk up, so ramps and slopes are simply walked up as in the original instead of lifting the ball.
- **The Radio's emoji stopped flickering.** The menu's 3D backdrop is animated every drawn frame, but the engine was
  also interpolating it between physics ticks, so an emoji returning to the top of the screen was drawn sliding
  through the middle of the view on the beat that reborn it. The backdrop, its glow passes and the trailer's scenes
  are no longer interpolated.
- **The Radio player's buttons answer the first click.** The card rebuilt its rows several times a second, which
  dropped the mouse that was hovering them and cancelled clicks in flight, so the ball toggle needed several presses
  and only lit up while the cursor kept moving. The rows now stay put, and a pressed button keeps its press while it
  shrinks.
- **The trailer no longer shows the end of the previous scene.** A finished scene leaves the tree at once instead of
  lingering for one more drawn frame under the next one.
- **The Radio's library scrolls.** A folder with more tracks than the window shows now scrolls under the same thin
  scrollbar as the rest of the game (the wheel, the thumb, the arrows), as it did in the original, instead of hiding
  everything past the bottom edge.
- **Long track names no longer run over their neighbours.** A name wider than its cell wraps onto further lines and
  grows the cell, the way the original wraps it.
- **The PROGRAM window's scrollbar can be dragged.** Its thumb follows the pointer and its arrows and strip step and
  page, instead of only the wheel scrolling the program.
- **The free-trial strip fits every language.** Where the line was longer than English (Russian, for one), the counts
  ran under the Unlock Radio button; the text now wraps in the room the button leaves.
- **The glass cards no longer have smeared corners.** The frosted backdrop was blurred over the whole square of the
  card, so outside its rounded corners a square of blurred background showed over bright scenery; the blur is now
  clipped to the corners, as a CSS backdrop filter is.
- **The library scrolls with the pointer over a track.** A cell took the mouse, so the wheel over one never reached
  the grid and nothing moved; the wheel now scrolls the library wherever it is inside the window.
- **Esc closes the pause menu.** It opened the pause but could not close it — a browser limitation of the original
  (Chrome takes the mouse away on Esc and refuses to give it back to the same key press). Esc now pauses and resumes,
  and steps back out of the in-match settings first.

- **The Radio player answers the first click again.** Its card rebuilt its rows several times a second, which let go
  of whatever the mouse was holding: the volume and position sliders took one click to grab and another to release,
  buttons lost hover and presses. The rows now stay put, and a held button keeps its pressed look.

- **RESUME no longer waits.** The pause menu's RESUME was held for a moment after the mouse was released — a browser
  limitation of the original (Chrome refuses to re-capture the mouse for about a second). The game takes the mouse
  back immediately.

## [1.1.2] - 2026-07-21

### Changed
- **Internal design docs are no longer tracked in git.** `docs/` has been in `.gitignore` for a while, but the
  30 plan/spec files added before that were still in the index. They are now untracked (the files stay on disk),
  so the repository carries only shipped code and its public documentation.

## [1.1.1] - 2026-07-19

### Fixed
- **Duel search kept only the first map selected.** On the Play screen, picking several maps and then pressing
  SEARCH (Steam quick-match) collapsed the highlight back to the first map — and the quick-match actually searched
  for that one map only, ignoring the rest of the selection. The map/duration choice is now retained when the idle
  room is torn down for search, so the full selection is highlighted and used for matchmaking.

## [1.1.0] - 2026-07-07

### Added
- **Map editor: box selection with copy/paste.** A new SELECT tool (key 5, or the B hotkey from any tool) marks
  two corner cells and highlights the box between them, stretching live to the crosshair before the second corner.
  C copies the selected blocks, X cuts, Delete clears; V enters paste mode — a translucent ghost of the fragment
  follows the crosshair, R spins it by 90° (wedges included), and it turns red where it would overlap blocks or
  poke out of the arena. Left click stamps the fragment and stays in paste mode for series; right click or a tool
  switch exits.
- **Map editor: autosave.** The editor now saves on its own — a 3-second pause after the last edit writes all
  three artifacts (source, compiled geometry, preview). Opening an existing map snapshots it to a session backup;
  a REVERT button restores that snapshot. Closing the tab mid-pause still flushes the map source. The SAVE button
  remains as an immediate manual save.
- **Map editor: edit properties of a selection.** With a box selected, the hotbar brush controls act on the
  selected blocks: pick a color to recolor them, toggle Opaque / Beam-blocking / Passable to change that property
  across the whole region. The selection stays put so several properties can be tweaked in a row; block type and
  wedge orientation are untouched.
- **Map editor: wedges on their side.** A wedge can now be laid on its side (key **G**) as a vertical diagonal
  wall — a full-height 45° corner for angled rooms and diagonal passages. R still picks which of the four corners;
  the wall renders, collides and blocks/passes beams by the usual flags in-game.
- **The Play screen, rebuilt — no more tabs.** One screen for everything: a mode carousel (Duel / Battle / War —
  the selected tile centered, its neighbours dimmed and clickable), unified seats in every mode, and a single
  action button that switches between SEARCH / STOP / READY / "waiting for others". Every empty seat offers two
  zones — inviting (the Steam friend picker on desktop; on web the seat shows "send to a friend: <code>" with
  click-to-copy) and "add a bot"; for a guest a free seat is a "take this seat" zone.
  A seated bot is edited right in its seat: name input, click-to-reroll, a per-seat normal/passive difficulty
  toggle and a remove cross. Web guests join through a compact "join by code" field under the seats — the old
  code-rendezvous flow (and web matchmaking) is gone, so who hosts a room is never a lottery. Entering the screen
  immediately hosts an open room (a private Steam lobby on desktop), Duel by default.
- **The menu stage seats four.** The lobby backdrop arranges up to four player balls in a square (the classic duel
  pair keeps its spots), with a dedicated wide camera pose for Battle/War — the pose follows the selected mode.
  Players pop in with a quick un-shrink and leave with a mirrored shrink; remote balls finally show their painted
  art and reserve-color ring in the lobby (an old bug).
- **Mode-aware match HUD and end screen.** Battle frames the timer with team totals and two players per side on a
  team-colored backing; War shows neutral panes with personal scores by the names. The end screen is one centered
  column — outcome, every player ranked by kills (HUD colors and streak effects preserved), reason, EXIT — nothing
  overlaps. The 3+-player READY list aligns names and statuses to the screen's center line.

### Fixed
- **A lobby could deadlock when someone left.** In War (and any room past its minimum), if you and another
  player were ready and the one you were still waiting on left, the match never started: everyone left was
  ready, the room had enough players, but nothing re-checked that — and a ready player has no button to press.
  The start condition is now re-evaluated after every change to the room, not only when someone toggles ready.
- **Walking a map in the editor now answers the same question the game does.** The editor's walk mode used its
  own step height (left behind at an old value), so a single cube read as a wall you couldn't climb while the
  game happily treats it as a stair — testing a map on foot gave the wrong answer.
- **Map borders align with the grid; border blocks no longer vanish.** Perimeter walls now sit entirely
  outside the floor with their inner face exactly on the arena edge, so the last row of blocks fits flush
  without poking into the wall — and long thin blocks along the border are no longer misread as stale wall
  trim and deleted on reopen.
- **Map editor stays responsive on large maps.** Wedges are drawn with instancing instead of thousands of
  separate meshes, and the cell-edge grid is built only when shown — editing a big map no longer stutters.
- **Large maps render fast.** Map geometry is split into spatial chunks so the GPU skips off-screen parts in
  every pass (color, shadows, outline) — heavy maps no longer tank the frame rate.
- **Player profile is tied to the Steam account.** The first time an account plays, the in-game name is seeded
  from Steam; afterwards every setting syncs from that account's Steam Cloud (so a second PC picks them up).
  Switching Steam accounts on a PC no longer shows or uploads the previous player's name, skin and artwork.
  Existing installs keep their profile untouched on upgrade.
- **Match music in Steam lobbies.** The soundtrack seed used to come from the room code, and code-less Steam
  lobbies got silence; now the room creator generates the seed and ships it to everyone — the whole lobby hears
  the same track.
- **Radio no longer stalls behind blocked sample CDNs.** The engine gives remote sample maps a short budget and
  boots on; the track library and DLC check resolve in parallel — the explorer window appears instantly instead of
  ~30s after opening the radio on networks where github raw is unreachable.

- **Steam lobby fits four.** The Steam "With friend" lobby now holds up to 4 players: empty 2v2/FFA seats offer
  "＋ invite a friend" (several invites at once — each pending friend shows as a waiting seat with a cancel), with a
  corner bot button as the alternative. A guest leaving the lobby no longer kicks the other guests. Quick match
  stays 1v1.
- **Game modes: 2v2 and Free-for-All (up to 4 players).** The lobby got a mode picker (1v1 / 2v2 / FFA) on the
  friend/bot tabs. 2v2/FFA rooms show a 4-seat grid: the host seats or removes bots with a click, a guest moves to
  any free seat (in 2v2 that switches their team). Teams spawn clustered at the two map points; FFA scatters players
  randomly with a minimum distance. Teammate bodies block your beam but never take harm. Name plates over remote
  players tell friend from foe (team-colored in 2v2, neutral in FFA, none in 1v1 — the classic duel looks untouched).
  A player leaving no longer kills the match while at least two teams remain; the final screen ranks teams by summed
  kills. Quick match stays 1v1.

### Changed
- **Networking rebuilt as a full mesh — no host authority.** Every peer now simulates the players it owns (itself
  and its bots) and is the sole judge of their deaths: the shooter raycasts what it sees, the claim goes straight to
  the victim's owner, and a raised shield on the VICTIM'S screen always wins. Scores, streaks and the match timer are
  derived locally by every peer from the same slim event stream — nothing to desync. A player (or even the lobby
  creator) leaving mid-match no longer ends it while two teams remain; their bots leave with them. Lag compensation,
  prediction-replay reconciliation and input buffering are gone entirely — your own movement is always fully local.
- **Player colors are a fixed identity now.** The primary+reserve color pair is part of a player's appearance and is
  never substituted: joining a room no longer swaps your color when it collides with the host's (two players may share
  a color — the upcoming multi-player rooms will disambiguate with team nameplates). The reserve color travels in the
  roster, so a remote player's planet ring is painted with THEIR actual reserve color instead of a copy of their
  primary; bots got a deterministic reserve color of their own.

## [1.0.1] - 2026-07-04

### Fixed
- **Online: a shield-blocked (or lost) hit claim no longer makes the opponent permanently unhittable for the client.**
  When the client's locally predicted kill was rejected by the host (the victim's shield came up within the RTT
  window — a perfect block — or the claim never arrived), the false death prediction was reverted visually but the
  opponent's raycast hitbox stayed disabled, so every later shot from that client passed straight through the opponent
  for the rest of the match (point-blank shots included). A rejected prediction now fully revives the opponent,
  hitbox included — immediately on the host's `block` verdict, or on the prediction-grace expiry for a lost claim.

## [1.0.0] - 2026-06-30

### Added
- **Diagnostic session logs.** The Steam build now writes a per-session log to `$APPDATA/logs` (auto-pruned to the
  last 15) capturing the full online lifecycle — connect, matchmaking, handshake, the agreed map/duration (with an
  explicit warning when your pick didn't overlap the opponent's), the phase ritual, in-match actions, periodic net
  health, Steam-transport diagnostics, and disconnects. Click the version number (bottom-right) to open the log folder
  for sharing.
- **Radio: seek / scrubbing.** The expanded player now has a progress bar with elapsed/total time — click or drag it
  to jump anywhere in the current track (live or a saved favorite). Seeks land on the beat.
- **Radio: a windowed code panel + a hide-ball toggle.** The desktop radio's Strudel-code panel (now titled PROGRAM)
  is a proper floating window — drag, resize, maximize, or minimize it to a bar over the player next to LIBRARY (same
  chrome; when both are minimized the last-collapsed sits on top). Clicking the code copies it (the title flashes
  "COPIED"). A new toggle in the player smoothly pans the camera off the player ball if you'd rather just watch the
  visuals. The redundant 🎲 re-roll button is gone — Next already advances the seed.

### Changed
- **Radio: play/pause is a TRUE pause.** Pressing pause now freezes the track exactly where it is and resume continues
  from the same spot, instead of stopping and restarting from the beginning. Next/Prev/seek auto-resume.
- **No more native hover tooltips in the UI.** It's a game — the browser `title` tooltips (radio track name, net/
  version chips, lobby code buttons, map-picker actions, colour swatches) are gone; accessible labels stay.
- **Hit detection is now shooter-authoritative — what you shoot is what you hit.** Each shooter decides its own hits:
  the client raycasts its beam locally and sends the host a hit claim, which the host applies after a loose sanity
  check (target alive, in range). This replaces host-side lag compensation for the client's shots and removes the
  host's zero-latency advantage, so both players hit with the same fairness.
- **Opponent deaths are predicted instantly on the client.** When your beam connects, the opponent drops on the spot
  instead of after a round-trip — the kill is held briefly until the host confirms (and quietly self-corrects on the
  rare rejection), so kills feel immediate.

### Fixed
- **"Sparks but no kill."** Hits that showed an impact on the client but weren't counted by the host are gone — the
  client's own shot now authoritatively registers, fixing missed hits on moving targets under latency.
- **A bot's shots now register hits on you.** The shooter-authoritative change had the host resolve only its own
  (local-player) hits, silently dropping every bot's hit — you could stand still, get clearly beamed, and take no
  damage. Bots are host-simulated (like the local player), so the host now resolves their hits too.

## [0.6.1] - 2026-06-29

### Added
- **Accept Steam invites in-game — no overlay needed.** The Steam overlay can't render over the desktop app, so a
  received invite now pops an **in-app toast** (the inviter's name + Accept / Decline) in the corner; Accept drops you
  straight into their match. Invites also work when launched cold (via `+connect_lobby`) and from the friends list.
  Declining now tells the host, which reverts its "waiting for friend" seat.
- **Client-side hit prediction.** Your beam's impact sparks appear the instant you fire (from your own raycast),
  instead of waiting a round-trip for the host to confirm.
- A new player's in-game name now defaults to their **Steam name**.

### Changed
- **Multiplayer netcode rebuilt — smooth on both sides (Source/CS2 model).** The simulation now runs on a fixed
  60 Hz tick with render interpolation, so it's frame-rate independent and smooth at any refresh. The client
  **predicts** its own movement and reconciles against the host with **full input replay** (no more rubber-band /
  being flung off the map). The opponent is rendered from an **interpolation buffer** (~100 ms back), so their
  movement is smooth regardless of packet jitter. **Lag compensation** rewinds the target to what the shooter saw,
  so shots land where you aim. Replaces the earlier per-frame, snap-correct, lerp-to-latest networking.
- **Client jitter eliminated.** The host no longer speculatively extrapolates a remote on a packet gap (it holds the
  avatar) and an input clock-sync keeps its jitter buffer steady — so the host's simulation stays identical to the
  client's prediction and there's nothing to snap back. Player-collision knockback is lag-compensated too (no bump
  when you bump). The reconciliation base is the host's state at the exact acked tick.
- The Radio **"Unlock"** button opens the store via a `steam://` link (the overlay can't render); ownership re-checks
  when the window regains focus, so a purchase applies without a restart.

### Fixed
- **Lag compensation registers hits on moving targets.** It now tracks the opponent through the beam's windup, so a
  direct hit on a moving player counts.
- **Steam Playtest invites work.** The app reads its App ID from the launch context instead of a hardcoded one, so a
  Playtest invite joins the Playtest (not the base game).
- The friend picker's headings use the game font.
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
