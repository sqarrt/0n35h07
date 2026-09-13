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
		or _mode.begins_with(MODE_HUD_BANNER) or _mode.begins_with(MODE_HUD_NAMES) or _mode.begins_with(MODE_PROFILE)
	if _mode.begins_with(MODE_PROFILE) and g != null:
		g.profile = PlayerProfile.sanitize(PARITY_PROFILE, g.random.randf)   # in memory only: the real profile stays
		g.lobby_bot_name = PARITY_BOT_NAME
	if _mode.begins_with(PROFILE_PREFIX):   # "profile:<mode>": the parity identity with any other fixture
		_mode = _mode.trim_prefix(PROFILE_PREFIX)
		_passive_bot = true
	var style_mode := _style_mode()
	if style_mode != "":
		_passive_bot = true
		if g != null:
			g.profile[STYLE_MODES[style_mode]] = _mode.trim_prefix(style_mode)
	root.add_child(load(scene_path).instantiate())
	if _passive_bot:
		_setup_fixture.call_deferred()

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
	var fixture_frames := _apply_hud_fixture()
	if _mode.begins_with(MODE_TP_REBIRTH):
		while _human().player.respawning:   # the rebirth offset counts from the materialisation
			await process_frame
	for i in fixture_frames:
		await process_frame   # let the HUD pick the fixture up (and play its animation) before drawing
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

func _vec(v: Vector3) -> Array:
	return [v.x, v.y, v.z]
