extends SceneTree
## Dev tool: render a scene for a few frames and save a screenshot, then quit.
## Needs a real rendering context (not --headless): scripts/godot.sh (WSL) or ./scripts/godot.ps1 (Windows)
##   --path . -s tools/screenshot.gd -- <scene> [<raw map>] [<output png>] [<capture frame>] [<mode>] [<match ms>]
## Modes:
##   passive-bot       the opponent stands still (like the web capture fixture); spawns and camera stay native.
##   reference-camera  passive bot + participants forced onto raw.spawns + camera forced to spawn 0 (tool-only).
##   hud-banner        passive bot + the streak banner announcing the local player's CATALYST, 600 ms in (web frame).
##   hud-ghost         passive bot + the local player in the ghost phase with half of it left (tool fixture).
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
const HUMAN_ID := 0
const REFERENCE_FOV := 75.0
const FIRST_BLOOD_STREAK := 1
const BANNER_FRAME_S := 0.6          # web capture takes the banner 600 ms after the kill
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
	_passive_bot = _reference_camera or _mode in [MODE_PASSIVE_BOT, MODE_HUD_BANNER, MODE_HUD_GHOST]
	root.add_child(load(scene_path).instantiate())
	if _passive_bot:
		_setup_fixture.call_deferred()

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

func _process(_delta: float) -> bool:
	_frames += 1
	if _frames >= _capture_frame and not _capture_started:
		_capture_started = true
		_capture()
	return _capture_done

## HUD states the tool can't reach by playing (tool-only fixtures, stated in reports).
func _apply_hud_fixture() -> bool:
	match _mode:
		MODE_HUD_BANNER:
			var banner := root.find_child("StreakBanner", true, false) as HudStreakBanner
			banner.announce(HudModel.player_name(HUMAN_ID), HudModel.announce_word(FIRST_BLOOD_STREAK, true))
			banner.tick(BANNER_FRAME_S)
			return true
		MODE_HUD_GHOST:
			var human := _human()
			human.player.respawning = true
			human.player.respawn_timer = MatchConst.RESPAWN_GHOST_MS * GHOST_SHARE_LEFT
			return true
	return false

func _capture() -> void:
	var camera := root.get_camera_3d()
	# reference-camera only: align the camera to the map's spawn 0. Other modes keep the game's own camera.
	if _reference_camera and camera != null:
		var map: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(_map_path))
		var spawn: Array = map["spawns"][HUMAN_ID]
		camera.global_position = Vector3(spawn[0], spawn[1], spawn[2])
		camera.global_rotation = Vector3.ZERO
		camera.fov = REFERENCE_FOV
	if _apply_hud_fixture():
		await process_frame   # let the HUD pick the fixture up before drawing
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
