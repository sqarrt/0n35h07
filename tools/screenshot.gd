extends SceneTree
## Dev tool: render a scene for a few frames and save a screenshot, then quit.
## Needs a real rendering context: ./scripts/godot.ps1 --path . -s tools/screenshot.gd
## Optionally override the scene: -- res://scenes/other.tscn . Output: user://shot.png

const DEFAULT_SCENE := "res://scenes/arena_test.tscn"
const CAPTURE_FRAME := 90
const OUT := "user://shot.png"

var _frames := 0
var _output := OUT
var _capture_frame := CAPTURE_FRAME
var _reference_camera := false
var _capture_started := false
var _capture_done := false
var _map_path := ""
const REFERENCE_FOV := 75.0

func _initialize() -> void:
	var scene_path := DEFAULT_SCENE
	var extra := OS.get_cmdline_user_args()
	if extra.size() > 0:
		scene_path = extra[0]
	if extra.size() > 1:
		_map_path = extra[1]
		var g := root.get_node_or_null("Game")   # autoload node (not a compile-time global here)
		if g != null:
			g.selected_map = extra[1]
	if extra.size() > 2:
		_output = extra[2]
	if extra.size() > 3:
		_capture_frame = maxi(1, int(extra[3]))
	if extra.size() > 4:
		_reference_camera = extra[4] == "reference-camera"
	root.add_child(load(scene_path).instantiate())
	if _reference_camera:
		_setup_reference.call_deferred()

func _setup_reference() -> void:
	var map: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(_map_path))
	for node in root.find_children("*", "", true, false):
		if node is PlayerNode:
			var spawn: Array = map["spawns"][node.player.id]
			var pos := Vector3(spawn[0], spawn[1], spawn[2])
			node.player.body.position = pos
			node.global_position = pos
			if node.player.id != 0:
				node.controller = null   # passive opponent, like the web capture fixture

func _process(_delta: float) -> bool:
	_frames += 1
	if _frames >= _capture_frame and not _capture_started:
		_capture_started = true
		_capture()
	return _capture_done

func _capture() -> void:
	var camera := root.get_camera_3d()
	# Optional comparison fixture: align the camera to the reference map spawn.
	# Ordinary captures preserve the game's actual spawn behavior.
	if _reference_camera and camera != null:
		var map: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(_map_path))
		var spawn: Array = map["spawns"][0]
		camera.global_position = Vector3(spawn[0], spawn[1], spawn[2])
		camera.global_rotation = Vector3.ZERO
		camera.fov = REFERENCE_FOV
	await RenderingServer.frame_post_draw
	var result := root.get_texture().get_image().save_png(_output)
	if result != OK:
		push_error("Screenshot save failed: %s" % error_string(result))
		quit(1)
		return
	var facts := {"map": _map_path, "capture_frame": _frames, "reference_camera": _reference_camera, "reference_spawns_and_passive_bot": _reference_camera}
	if camera != null:
		facts["camera"] = {"position": [camera.global_position.x, camera.global_position.y, camera.global_position.z], "fov": camera.fov}
	for node in root.find_children("*", "", true, false):
		if node is MatchNode:
			facts["live"] = node.is_live()
	var metadata := FileAccess.open(_output + ".json", FileAccess.WRITE)
	metadata.store_string(JSON.stringify(facts, "\t"))
	print("SHOT_SAVED ", ProjectSettings.globalize_path(_output))
	_capture_done = true
