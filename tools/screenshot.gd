extends SceneTree
## Dev tool: render a scene for a few frames and save a screenshot, then quit.
## Needs a real rendering context (not --headless): scripts/godot.sh (WSL) or ./scripts/godot.ps1 (Windows)
##   --path . -s tools/screenshot.gd -- <scene> [<raw map>] [<output png>] [<capture frame>] [<mode>] [<match ms>]
## Modes:
##   passive-bot       the opponent stands still (like the web capture fixture); spawns and camera stay native.
##   reference-camera  passive bot + participants forced onto raw.spawns + camera forced to spawn 0 (tool-only).
##   hud-banner        passive bot + the streak banner announcing the local player's CATALYST, 600 ms in (web frame).
##   hud-banner-<kind> the same for catalyst / double / triple / singularity (web __debugAnnounce frames).
##   hud-names-<tier>  passive bot + both players on a double / triple / singularity streak, 600 ms in
##                     (web __debugStreak frames).
##   third-person      passive bot + the human's view toggled to third person (web: the V key).
##   third-person-windup   the same, halfway through an own windup (200 ms after the click).
##   third-person-deflate  the same, 50 ms after the own shot (inside the 200 ms deflate).
##   third-person-shot-<style>  the profile's windup style set to classic / rage / singularity, 50 ms into the beam.
##   third-person-shield-<style>  shield style dome / hex / crystal, 100 ms after raising the shield.
##   third-person-dash-<style>    dash style streak / wave / rift, ≈ 60 ms into a dash straight ahead.
##   third-person-windup-<style>  windup style rage / singularity, 200 ms into an own charge (the world part).
##   third-person-ghost-<style>   respawn style echo / chaos / swarm, 600 ms into a ghost phase (no shooter).
##   third-person-rebirth-<style> the same style, REBIRTH_FRAMES after materialising at the end of that ghost.
##   hud-ghost         passive bot + the local player in the ghost phase with half of it left (tool fixture).
##   hud-overheat-<tier>  passive bot + the local player on a double / triple / singularity streak; with
##                     web-overheat-<tier>.json next to the output PNG (parity-capture-overheat.mjs) the vignette shows
##                     exactly those bolts at their strike peak with the pulse at its start.
##   hud-audio-bar-<run>  passive bot + the visualiser fed the fixed bands of web-audio-bar-<run>.json next to the
##                     output PNG (parity-capture-audio-bar.mjs), 90 frames to settle; the bar geometry joins the facts.
##   hud-stats         passive bot + the profile's showFps / showSpeed on, the stats overlay frozen on the readings of
##                     web-stats.json next to the output PNG (parity-capture-stats.mjs); its boxes join the facts.
##   pause-<state>     the pause menu (web parity-capture-buttons.mjs): the pointer lock dropped, QUIT hidden like the
##                     browser build and the RESUME cooldown frozen — state cooldown (halfway), idle (over),
##                     hover-ghost (TO MENU hovered) or hover-primary (RESUME hovered); its boxes join the facts.
##   match-end-hover   the match-end screen (pass <match ms>) with EXIT hovered once the column has settled.
##   menu-browser      the main menu scene in the browser build's layout (web parity-capture-menu.mjs: the F11 hint,
##                     no QUIT); menu-hover-play / menu-hover-secondary also hover PLAY / APPEARANCE. Its boxes join
##                     the facts.
##   lobby-<state>     the main menu scene with PLAY opened (web parity-capture-lobby.mjs): fresh, bot (a passive
##                     EX82R on seat 1), 2v2 or ffa; a -bottom suffix scrolls the body to its end. Use with profile:.
##   stage-<state>     the same lobby with only its seat balls on the backdrop (web parity-capture-lobby-stage.mjs): bot
##                     (Duel, EX82R on seat 1) or ffa (War, B1..B3 on seats 1..3); the light pinned. Use with profile:.
##   team-<mode>       a Battle (2v2) or War (ffa) match from a lobby roster: the parity human on seat 0 and passive
##                     bots B1..B3 (web parity-capture-teams.mjs); the team bar boxes join the facts. Use with profile:.
##   profile           passive bot + a fixed in-memory profile (PARITY7, #fa4) and bot name EX82R, never saved
##                     (web parity-capture-profile.mjs identity).
##   profile-double    the same with both players on a double streak, 600 ms in.
##   profile:<mode>    the parity identity combined with any mode above, e.g. profile:hud-banner-singularity.
##   (any other value, e.g. "-") no fixture.
## <match ms> overrides Game.match_duration_ms, e.g. to capture the match-end screen quickly.
## Writes <output png>.json with the capture facts (map, frame, mode, camera, live/ended, player positions).

const DEFAULT_SCENE := "res://scenes/arena_test.tscn"
const CAPTURE_FRAME := 90
const OUT := "user://shot.png"
const MODE_PASSIVE_BOT := "passive-bot"
const MODE_REFERENCE_CAMERA := "reference-camera"
const MODE_HUD_BANNER := "hud-banner"
const MODE_HUD_GHOST := "hud-ghost"
const MODE_HUD_NAMES := "hud-names-"
const MODE_HUD_OVERHEAT := "hud-overheat-"
const OVERHEAT_FIXTURE := "web-overheat-%s.json"
const OVERHEAT_FRAMES := 2           # the HUD picks the streak up, then the frozen fixture draws
const MODE_HUD_AUDIO_BAR := "hud-audio-bar-"
const AUDIO_BAR_FIXTURE := "web-audio-bar-%s.json"
const AUDIO_BAR_FRAMES := 90         # web settles the line's smoothing for 1.5 s (at --fixed-fps 60)
const MODE_HUD_STATS := "hud-stats"
const STATS_FIXTURE := "web-stats.json"
const STATS_FRAMES := 2              # the HUD shows the overlay, then the frozen fixture draws
const MODE_PAUSE := "pause-"
const PAUSE_COOLDOWN := "cooldown"
const PAUSE_HOVER_GHOST := "hover-ghost"
const PAUSE_HOVER_PRIMARY := "hover-primary"
const PAUSE_COOLDOWN_SHARE := 0.5    # web __debugLockCooldownLeft = half of POINTERLOCK_COOLDOWN
const PAUSE_FRAMES := 3              # the column lays out, then the frozen cooldown draws
const MODE_MATCH_END_HOVER := "match-end-hover"
const END_SETTLE_FRAMES := 12        # the 0.1 s fade and the column layout (at --fixed-fps 60)
const HOVER_FRAMES := 2              # the button takes the hover look
const HOVER_TARGETS := {"pause-hover-ghost": "ToMenu", "pause-hover-primary": "Resume", "match-end-hover": "Exit",
	"menu-hover-play": "Play", "menu-hover-secondary": "Appearance"}
const MODE_TEAM := "team-"
const PLATE_SUFFIX := "-plate"        # team-<mode>-plate: an enemy bot placed in front of the camera
const PLATE_BOT_ID := 2
const PLATE_DISTANCE := 4.0           # world units along the camera's look (web parity-capture-nameplate.mjs)
const PLATE_FRAMES := 20
const TEAM_BOT_SLOTS := [1, 2, 3]
const TEAM_BOT_NAME := "B%d"
const TEAM_BOXES := ["TeamBar", "TeamLeft", "TeamRight", "TotalLeft", "TotalRight", "Timer", "Row0", "Row1", "Row2", "Row3"]
const MODE_LOBBY := "lobby-"
const LOBBY_BOTTOM := "-bottom"
const LOBBY_BOT_SLOT := 1
const LOBBY_BOT_NAME := "EX82R"
const LOBBY_BOT_DIFFICULTY := "passive"
const LOBBY_FRAMES := 30             # the carousel's .25 s ease and the layout (at --fixed-fps 60)
const LOBBY_SCROLL_S := 0.2          # scroll once the body knows its content height
const LOBBY_BOXES := ["Title", "Modes", "MapLabel", "Multi", "SelectAll", "TimeLabel", "Time3", "Time5", "Time10",
	"PlayersLabel", "Seats", "Seat0", "Seat1", "Seat2", "Seat3", "Vs", "Ready", "Back", "Map_os_arena", "Map_os_india",
	"Map_os_pillars", "Map_os_pool_day", "Map_os_test"]
const MODE_STAGE := "stage-"           # stage-bot / stage-ffa: the lobby's seat balls alone, the light pinned at 0
const STAGE_FFA := "ffa"
const STAGE_FRAMES := 90               # the camera damping, the fade-in and the colour easing (web settles 1.5 s)
const STAGE_BALL_TIME_S := 1.0         # the balls' shader clock (web __debugMenuBallTime)
const MODE_MENU_BALL := "menu-ball-"   # menu-ball-<degrees>: the backdrop alone, the light pinned
const MODE_MENU_FULL := "menu-full-"   # menu-full-<degrees>: the browser menu over it, the light pinned
const MENU_UI := ["Panel", "Version"]
const MENU_BALL_FRAMES := 90          # past the warm-up and the whole fade (web settles for seconds)
const MODE_MENU := "menu-"
const MENU_FRAMES := 3               # the column lays out in the browser layout
const MENU_BOXES := ["Panel", "Logo", "Rule", "Play", "Appearance", "Settings", "About", "Quit", "Hint", "Version"]
const MODE_THIRD_PERSON := "third-person"
const MODE_TP_WINDUP := "third-person-windup"
const MODE_TP_DEFLATE := "third-person-deflate"
const HALF_WINDUP_FRAMES := 12       # 200 ms at --fixed-fps 60 (BEAM_WINDUP 400 ms)
const DEFLATE_FRAMES := 27           # 450 ms: the shot at 400 ms plus 50 ms of deflate
const MODE_TP_SHOT := "third-person-shot-"
const MODE_TP_SHIELD := "third-person-shield-"
const MODE_TP_DASH := "third-person-dash-"
const MODE_TP_WINDUP_STYLE := "third-person-windup-"
const MODE_TP_GHOST := "third-person-ghost-"
const MODE_TP_REBIRTH := "third-person-rebirth-"
## Style fixtures: mode prefix -> the profile key it sets from the mode suffix.
const STYLE_MODES := {MODE_TP_SHOT: "windupStyle", MODE_TP_WINDUP_STYLE: "windupStyle", MODE_TP_SHIELD: "shieldStyle",
	MODE_TP_DASH: "dashStyle", MODE_TP_GHOST: "respawnStyle", MODE_TP_REBIRTH: "respawnStyle"}
const SHIELD_FRAMES := 6             # 100 ms into the shield
const DASH_FRAMES := 4               # ≈ 60 ms into the dash (web frame 60 ms)
const GHOST_FRAMES := 36             # 600 ms into the ghost
const REBIRTH_FRAMES := 8            # ≈ 133 ms after materialising (web frame measured ≈ 140 ms)
const MODE_PROFILE := "profile"
const MODE_PROFILE_DOUBLE := "profile-double"
const PROFILE_PREFIX := "profile:"
const PARITY_PROFILE := {"name": "PARITY7", "primaryColor": "#fa4", "reserveColor": "#4af"}
const PARITY_BOT_NAME := "EX82R"
const VIEW_SETTLE_FRAMES := 2        # the controller places the camera on its next frame
const KIND_SEPARATOR := "-"
const HUMAN_ID := 0
const REFERENCE_FOV := 75.0
const FIRST_BLOOD_KIND := "catalyst"
const TIER_STREAKS := {"double": Streak.STREAK_DOUBLE, "triple": Streak.STREAK_TRIPLE,
	"singularity": Streak.STREAK_SINGULARITY}
const BANNER_FRAME_S := 0.6          # web capture takes the banner 600 ms after the kill
const NAME_FRAME_FRAMES := 36        # web capture takes the names 600 ms after __debugStreak (at --fixed-fps 60)
const GHOST_SHARE_LEFT := 0.5
const ARG_SCENE := 0
const ARG_MAP := 1
const ARG_OUTPUT := 2
const ARG_FRAME := 3
const ARG_MODE := 4
const ARG_MATCH_MS := 5
const NO_OVERRIDE := -1.0

## The pause fixture's pointer lock: dropped on cue instead of reading the real mouse mode.
class ToolLock extends PointerLock:
	var locked := true

	func is_locked() -> bool:
		return locked

var _frames := 0
var _output := OUT
var _capture_frame := CAPTURE_FRAME
var _mode := ""
var _reference_camera := false
var _passive_bot := false
var _match_ms := NO_OVERRIDE
var _capture_started := false
var _capture_done := false
var _map_path := ""

func _initialize() -> void:
	var extra := OS.get_cmdline_user_args()
	var scene_path := extra[ARG_SCENE] if extra.size() > ARG_SCENE else DEFAULT_SCENE
	var g := root.get_node_or_null("Game")   # autoload node (not a compile-time global here)
	if extra.size() > ARG_MAP:
		_map_path = extra[ARG_MAP]
		if g != null:
			g.selected_map = _map_path
	if extra.size() > ARG_OUTPUT:
		_output = extra[ARG_OUTPUT]
	if extra.size() > ARG_FRAME:
		_capture_frame = maxi(1, int(extra[ARG_FRAME]))
	if extra.size() > ARG_MODE:
		_mode = extra[ARG_MODE]
	if extra.size() > ARG_MATCH_MS:
		_match_ms = float(extra[ARG_MATCH_MS])
		if g != null:
			g.match_duration_ms = _match_ms
	_reference_camera = _mode == MODE_REFERENCE_CAMERA
	_passive_bot = _reference_camera or _mode in [MODE_PASSIVE_BOT, MODE_HUD_GHOST, MODE_THIRD_PERSON, MODE_TP_WINDUP,
		MODE_TP_DEFLATE] \
		or _mode.begins_with(MODE_HUD_BANNER) or _mode.begins_with(MODE_HUD_NAMES) or _mode.begins_with(MODE_PROFILE) \
		or _mode.begins_with(MODE_HUD_OVERHEAT) or _mode.begins_with(MODE_HUD_AUDIO_BAR) or _mode == MODE_HUD_STATS
	if _mode.begins_with(MODE_PROFILE) and g != null:
		g.profile = PlayerProfile.sanitize(PARITY_PROFILE, g.random.randf)   # in memory only: the real profile stays
		g.lobby_bot_name = PARITY_BOT_NAME
	if _mode.begins_with(PROFILE_PREFIX):   # "profile:<mode>": the parity identity with any other fixture
		_mode = _mode.trim_prefix(PROFILE_PREFIX)
		_passive_bot = true
	if _mode.begins_with(MODE_TEAM) and g != null:   # the lobby's seats for a Battle / War match
		_team_roster(g, _mode.trim_prefix(MODE_TEAM).trim_suffix(PLATE_SUFFIX))
		_passive_bot = false                          # the roster's passive bots already stand still
	if _mode == MODE_HUD_STATS and g != null:   # web profile showFps / showSpeed
		g.profile["showFps"] = true
		g.profile["showSpeed"] = true
	var style_mode := _style_mode()
	if style_mode != "":
		_passive_bot = true
		if g != null:
			g.profile[STYLE_MODES[style_mode]] = _mode.trim_prefix(style_mode)
	root.add_child(load(scene_path).instantiate())
	if _passive_bot:
		_setup_fixture.call_deferred()

## web parity-capture-teams.mjs seats: the parity human on seat 0, passive bots B1..B3 on the others.
func _team_roster(g: Node, mode: String) -> void:
	var roster: Array = [Roster.human_entry(HUMAN_ID, g.get("profile"))]
	for slot in TEAM_BOT_SLOTS:
		roster.append(Roster.bot_entry(slot, TEAM_BOT_NAME % slot, RoomModel.PASSIVE_DIFFICULTY))
	g.set("lobby_mode", mode)
	g.set("lobby_roster", roster)

func _style_mode() -> String:
	for prefix in STYLE_MODES:
		if _mode.begins_with(prefix):
			return prefix
	return ""

func _players() -> Array:
	return root.find_children("*", "", true, false).filter(func(n): return n is PlayerNode)

func _human() -> PlayerNode:
	for node in _players():
		if node.player.id == HUMAN_ID:
			return node
	return null

func _setup_fixture() -> void:
	var map := {}
	if _reference_camera:
		map = JSON.parse_string(FileAccess.get_file_as_string(_map_path))
	for node in _players():
		if _reference_camera:
			var spawn: Array = map["spawns"][node.player.id]
			node.place_at(Vector3(spawn[0], spawn[1], spawn[2]))
		if node.player.id != HUMAN_ID:
			node.controller = null   # passive opponent, like the web capture fixture
		if _mode == MODE_PROFILE_DOUBLE:
			node.player.streak = Streak.STREAK_DOUBLE   # from the start, so the result screen keeps the effect too

func _process(_delta: float) -> bool:
	_frames += 1
	if _frames >= _capture_frame and not _capture_started:
		_capture_started = true
		_capture()
	return _capture_done

## HUD states the tool can't reach by playing (tool-only fixtures, stated in reports); returns the frames to render
## before the capture (0 = no fixture).
func _apply_hud_fixture() -> int:
	if _mode.begins_with(MODE_HUD_BANNER):
		var kind := _mode.trim_prefix(MODE_HUD_BANNER).trim_prefix(KIND_SEPARATOR)
		var banner := root.find_child("StreakBanner", true, false) as HudStreakBanner
		var roster := (root.find_children("*", "MatchNode", true, false)[0] as MatchNode).roster
		banner.announce(roster.name_of(HUMAN_ID), kind if kind != "" else FIRST_BLOOD_KIND,
			roster.color_of(HUMAN_ID, AppearanceConst.FALLBACK_EFFECT_COLOR))
		banner.tick(BANNER_FRAME_S)
		return 1
	if _mode.begins_with(MODE_HUD_NAMES) or _mode == MODE_PROFILE_DOUBLE:
		var tier := "double" if _mode == MODE_PROFILE_DOUBLE else _mode.trim_prefix(MODE_HUD_NAMES)
		var streak: int = TIER_STREAKS[tier]
		for node in _players():
			node.player.streak = streak
		return NAME_FRAME_FRAMES
	if _mode.begins_with(MODE_TP_GHOST) or _mode.begins_with(MODE_TP_REBIRTH):
		(root.find_children("*", "HumanController", true, false)[0] as HumanController).toggle_view()
		_human().player.apply_death()   # web __debugKill: a ghost phase without a shooter
		return GHOST_FRAMES if _mode.begins_with(MODE_TP_GHOST) else REBIRTH_FRAMES
	if _mode.begins_with(MODE_TP_SHIELD) or _mode.begins_with(MODE_TP_DASH):
		(root.find_children("*", "HumanController", true, false)[0] as HumanController).toggle_view()
		if _mode.begins_with(MODE_TP_SHIELD):
			_human().player.activate_shield()   # web: right mouse button
			return SHIELD_FRAMES
		_human().player.dash(Vector3.FORWARD)   # web: W held + Shift, straight at the bot
		return DASH_FRAMES
	if _mode in [MODE_THIRD_PERSON, MODE_TP_WINDUP, MODE_TP_DEFLATE] or _mode.begins_with(MODE_TP_SHOT) \
			or _mode.begins_with(MODE_TP_WINDUP_STYLE):
		(root.find_children("*", "HumanController", true, false)[0] as HumanController).toggle_view()
		if _mode == MODE_THIRD_PERSON:
			return VIEW_SETTLE_FRAMES
		_human().player.start_firing()   # web: one mousedown
		var half := _mode == MODE_TP_WINDUP or _mode.begins_with(MODE_TP_WINDUP_STYLE)
		return HALF_WINDUP_FRAMES if half else DEFLATE_FRAMES   # the shot frame = 50 ms into it
	if _mode.begins_with(MODE_PAUSE):
		_pause_fixture(_mode.trim_prefix(MODE_PAUSE))
		return PAUSE_FRAMES
	if _mode.begins_with(MODE_LOBBY):
		_lobby_fixture(_mode.trim_prefix(MODE_LOBBY))
		return LOBBY_FRAMES
	if _mode.begins_with(MODE_TEAM) and _mode.ends_with(PLATE_SUFFIX):
		# web __debugPlace(2, camera + look * 4): an enemy close enough to read its plate
		var camera := root.get_camera_3d()
		var look := -camera.global_basis.z
		var target := camera.global_position + Vector3(look.x, 0.0, look.z).normalized() * PLATE_DISTANCE
		for node in _players():
			if node.player.id == PLATE_BOT_ID:
				node.place_at(Vector3(target.x, node.global_position.y, target.z))
		return PLATE_FRAMES
	if _mode.begins_with(MODE_STAGE):
		# web parity-capture-lobby-stage.mjs: the room's seats as backdrop balls, every UI layer hidden
		var state := _mode.trim_prefix(MODE_STAGE)
		var menu: Node = root.find_children("*", "MainMenu", true, false)[0]
		menu.call("open_lobby")
		var room: Object = menu.call("lobby").get("room")
		if state == STAGE_FFA:
			room.call("set_mode", STAGE_FFA)
			for slot in TEAM_BOT_SLOTS:
				room.call("add_bot", slot, LOBBY_BOT_DIFFICULTY, TEAM_BOT_NAME % slot)
		else:
			room.call("add_bot", LOBBY_BOT_SLOT, LOBBY_BOT_DIFFICULTY, LOBBY_BOT_NAME)
		for ui_name in MENU_UI:
			(menu.find_child(ui_name, true, false) as CanvasItem).visible = false
		(menu.call("lobby") as CanvasItem).visible = false
		menu.call("backdrop").call("set_light_angle", 0.0)
		menu.call("backdrop").call("pin_ball_time", STAGE_BALL_TIME_S)
		return STAGE_FRAMES
	if _mode.begins_with(MODE_MENU_FULL):
		# the browser menu over the backdrop, the orbiting light pinned (web parity-capture-menu-ball.mjs full frames)
		for menu in root.find_children("*", "MainMenu", true, false):
			menu.call("set_browser_layout", true)
			menu.call("backdrop").call("set_light_angle", deg_to_rad(float(_mode.trim_prefix(MODE_MENU_FULL))))
		return MENU_BALL_FRAMES
	if _mode.begins_with(MODE_MENU_BALL):
		# web parity-capture-menu-ball.mjs: only the 3D backdrop, the orbiting light pinned at the frame's angle
		for menu in root.find_children("*", "MainMenu", true, false):
			for ui_name in MENU_UI:
				(menu.find_child(ui_name, true, false) as CanvasItem).visible = false
			menu.call("backdrop").call("set_light_angle", deg_to_rad(float(_mode.trim_prefix(MODE_MENU_BALL))))
		return MENU_BALL_FRAMES
	if _mode.begins_with(MODE_MENU):
		for menu in root.find_children("*", "MainMenu", true, false):
			# the web capture runs in a browser tab; call() keeps MainMenu (it uses autoload names) out of this tool's
			# compile-time dependencies — autoloads aren't globals in a -s script
			menu.call("set_browser_layout", true)
		return MENU_FRAMES
	if _mode == MODE_HUD_STATS:
		var stats_fixture := _output.get_base_dir().path_join(STATS_FIXTURE)
		var stats_json := JSON.new()
		var overlay := root.find_child("StatsOverlay", true, false) as HudStatsOverlay
		if overlay != null and FileAccess.file_exists(stats_fixture) \
				and stats_json.parse(FileAccess.get_file_as_string(stats_fixture)) == OK:
			var stats: Dictionary = stats_json.data["stats"]
			overlay.show_fixture(int(stats["fps"]), float(stats["worstMs"]), PackedFloat32Array(stats["frameTimes"]),
				float(stats["speed"]))
		return STATS_FRAMES
	if _mode.begins_with(MODE_HUD_AUDIO_BAR):
		var bar_fixture := _output.get_base_dir().path_join(AUDIO_BAR_FIXTURE % _mode.trim_prefix(MODE_HUD_AUDIO_BAR))
		var bar_json := JSON.new()
		if FileAccess.file_exists(bar_fixture) and bar_json.parse(FileAccess.get_file_as_string(bar_fixture)) == OK:
			var audio := root.get_node_or_null("Audio")   # autoload node (not a compile-time global in a tool script)
			if audio != null:
				audio.debug_bands = PackedFloat32Array(bar_json.data["bands"])
		return AUDIO_BAR_FRAMES
	if _mode.begins_with(MODE_HUD_OVERHEAT):
		var tier := _mode.trim_prefix(MODE_HUD_OVERHEAT)
		_human().player.streak = TIER_STREAKS[tier]
		var fixture := _output.get_base_dir().path_join(OVERHEAT_FIXTURE % tier)
		if FileAccess.file_exists(fixture):
			var json := JSON.new()
			if json.parse(FileAccess.get_file_as_string(fixture)) == OK:
				var vignette := root.find_child("OverheatVignette", true, false) as HudOverheatVignette
				vignette.show_fixture(tier, _web_bolts(json.data["bolts"]))
		return OVERHEAT_FRAMES
	if _mode == MODE_HUD_GHOST:
		var human := _human()
		human.player.respawning = true
		human.player.respawn_timer = MatchConst.RESPAWN_GHOST_MS * GHOST_SHARE_LEFT
		return 1
	return 0

func _capture() -> void:
	var camera := root.get_camera_3d()
	# reference-camera only: align the camera to the map's spawn 0. Other modes keep the game's own camera.
	if _reference_camera and camera != null:
		var map: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(_map_path))
		var spawn: Array = map["spawns"][HUMAN_ID]
		camera.global_position = Vector3(spawn[0], spawn[1], spawn[2])
		camera.global_rotation = Vector3.ZERO
		camera.fov = REFERENCE_FOV
	if not _mode.begins_with(MODE_PAUSE):
		for pause in root.find_children("*", "PauseOverlay", true, false):
			(pause as PauseOverlay).setup(func() -> bool: return false)   # an unfocused capture window never pauses
			(pause as PauseOverlay).refresh()
	var fixture_frames := _apply_hud_fixture()
	if _mode.begins_with(MODE_TP_REBIRTH):
		while _human().player.respawning:   # the rebirth offset counts from the materialisation
			await process_frame
	for i in fixture_frames:
		await process_frame   # let the HUD pick the fixture up (and play its animation) before drawing
	await _hover_fixture()
	await RenderingServer.frame_post_draw
	var result := root.get_texture().get_image().save_png(_output)
	if result != OK:
		push_error("Screenshot save failed: %s" % error_string(result))
		quit(1)
		return
	var facts := {"map": _map_path, "capture_frame": _frames, "mode": _mode,
		"reference_camera": _reference_camera, "passive_bot": _passive_bot}
	if _match_ms != NO_OVERRIDE:
		facts["match_duration_ms"] = _match_ms
	if camera != null:
		facts["camera"] = {"position": _vec(camera.global_position), "fov": camera.fov}
	var positions := {}
	for node in _players():
		positions[str(node.player.id)] = _vec(node.global_position)
	facts["players"] = positions
	var audio_bar := root.find_child("AudioBar", true, false) as HudAudioBar
	if audio_bar != null:
		facts["audio_bar"] = {"visible": audio_bar.visible, "origin": [audio_bar.bar_origin().x, audio_bar.bar_origin().y],
			"size": [audio_bar.bar_size().x, audio_bar.bar_size().y],
			"points": Array(audio_bar.line_points()).map(func(p: Vector2) -> Array: return [p.x, p.y])}
	var stats_overlay := root.find_child("StatsOverlay", true, false) as HudStatsOverlay
	if stats_overlay != null:
		facts["stats"] = {"visible": stats_overlay.visible, "fps_text": stats_overlay.fps_text().label().text,
			"speed_text": stats_overlay.speed_text().label().text, "fps": _rect(stats_overlay.fps_text()),
			"graph": _rect(stats_overlay.graph()), "speed": _rect(stats_overlay.speed_text())}
	for team_bar in root.find_children("*", "HudTeamBar", true, false):
		var team_boxes := {}
		for box_name in TEAM_BOXES:
			var control := team_bar.find_child(box_name, true, false) as Control
			if control == null and team_bar.name == box_name:
				control = team_bar as Control
			if control != null and control.is_visible_in_tree():
				team_boxes[box_name] = _rect(control)
		facts["HudTeamBar"] = team_boxes
	for lobby in root.find_children("*", "LobbyScreen", true, false):
		var lobby_boxes := {}
		for box_name in LOBBY_BOXES:
			var control := lobby.find_child(box_name, true, false) as Control
			if control != null and control.is_visible_in_tree():
				lobby_boxes[box_name] = _rect(control)
		lobby_boxes["scroll"] = (lobby.find_child("Body", true, false) as ScrollContainer).scroll_vertical
		facts["LobbyScreen"] = lobby_boxes
	for menu in root.find_children("*", "MainMenu", true, false):
		var menu_boxes := {}
		for box_name in MENU_BOXES:
			var control := menu.find_child(box_name, true, false) as Control
			if control != null and control.is_visible_in_tree():
				menu_boxes[box_name] = _rect(control)
		facts["MainMenu"] = menu_boxes
	for overlay_class in ["PauseOverlay", "MatchEndedOverlay"]:
		for overlay in root.find_children("*", overlay_class, true, false):
			var column := overlay.find_child("Column", true, false) as CssColumn
			if not overlay.visible or column == null:
				continue
			var boxes := {}
			for child in column.get_children():
				if child is Control and child.visible:
					boxes[str(child.name)] = _rect(child)
			var resume := column.find_child("Resume", true, false) as UiButton
			var cooldown := resume.get_theme_stylebox("disabled") as UiButton.CooldownStyle if resume != null else null
			if cooldown != null and resume.disabled:
				var fill := cooldown.fill_rect(Rect2(resume.global_position, resume.size))
				boxes["ResumeFill"] = [fill.position.x, fill.position.y, fill.size.x, fill.size.y]
			facts[overlay_class] = boxes
	var human := _human()
	if human != null:
		facts["human_respawning"] = human.player.respawning
		facts["human_ghost_left_ms"] = human.player.respawn_timer
	for node in root.find_children("*", "", true, false):
		if node is MatchNode:
			facts["live"] = node.is_live()
			facts["ended"] = node.is_ended()
			facts["countdown"] = node.countdown_label()
	var metadata := FileAccess.open(_output + ".json", FileAccess.WRITE)
	metadata.store_string(JSON.stringify(facts, "\t"))
	print("SHOT_SAVED ", ProjectSettings.globalize_path(_output))
	_capture_done = true

## web parity-capture-buttons.mjs pause frames: a live match whose pointer lock drops at clock 0, the clock frozen
## halfway through the RESUME cooldown or past it, and QUIT hidden like the browser build.
func _pause_fixture(state: String) -> void:
	var pause := root.find_children("*", "PauseOverlay", true, false)[0] as PauseOverlay
	var match_node := root.find_children("*", "MatchNode", true, false)[0] as MatchNode
	var lock := ToolLock.new()
	var clock := {"now": 0.0}
	pause.setup(match_node.is_live, lock, func() -> float: return clock["now"])
	pause.refresh()
	lock.locked = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE   # the human controller reads the real mouse mode
	pause.refresh()
	clock["now"] = PauseModel.COOLDOWN_MS * (PAUSE_COOLDOWN_SHARE if state == PAUSE_COOLDOWN else 1.0)
	pause.set_quit_visible(false)
	pause.refresh()

## web parity-capture-lobby.mjs frames: PLAY opened on the main menu, then the state's room, scrolled for -bottom.
## Reached through call(): MainMenu / LobbyScreen use autoload names, which a -s tool can't compile against.
func _lobby_fixture(state: String) -> void:
	var menu: Node = root.find_children("*", "MainMenu", true, false)[0]
	menu.call("open_lobby")
	var lobby: Node = menu.call("lobby")
	var room: Object = lobby.get("room")
	var to_end := state.ends_with(LOBBY_BOTTOM)
	match state.trim_suffix(LOBBY_BOTTOM):
		"bot":
			room.call("add_bot", LOBBY_BOT_SLOT, LOBBY_BOT_DIFFICULTY, LOBBY_BOT_NAME)
		"2v2", "ffa":
			room.call("set_mode", state.trim_suffix(LOBBY_BOTTOM))
	if to_end:
		create_timer(LOBBY_SCROLL_S).timeout.connect(func() -> void: lobby.call("scroll_to_end", true))

## web page.hover(): a mouse motion pushed onto the laid-out button (for match-end-hover, once the screen has settled).
func _hover_fixture() -> void:
	if not HOVER_TARGETS.has(_mode):
		return
	if _mode == MODE_MATCH_END_HOVER:
		var ended := root.find_children("*", "MatchEndedOverlay", true, false)[0] as MatchEndedOverlay
		while not ended.visible:
			await process_frame
		for i in END_SETTLE_FRAMES:
			await process_frame
	var target := root.find_child(HOVER_TARGETS[_mode], true, false) as Control
	var motion := InputEventMouseMotion.new()
	motion.position = target.get_global_rect().get_center()
	motion.global_position = motion.position
	root.push_input(motion)
	for i in HOVER_FRAMES:
		await process_frame

## web bolts ({side, topPct, length, segments: [{from: [x, y], to: [x, y], width}]}) in OverheatFx form.
func _web_bolts(bolts: Array) -> Array:
	var out := []
	for bolt in bolts:
		var segments := []
		for s in bolt["segments"]:
			segments.append({"from": Vector2(s["from"][0], s["from"][1]), "to": Vector2(s["to"][0], s["to"][1]),
				"width": float(s["width"])})
		out.append({"side": bolt["side"], "top_pct": float(bolt["topPct"]), "length": float(bolt["length"]),
			"segments": segments})
	return out

func _rect(control: Control) -> Array:
	return [control.global_position.x, control.global_position.y, control.size.x, control.size.y]

func _vec(v: Vector3) -> Array:
	return [v.x, v.y, v.z]
