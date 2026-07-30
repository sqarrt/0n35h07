extends SceneTree
## Dev tool: render a scene for a few frames and save a screenshot, then quit.
## Needs a real GL context (e.g. WSLg): scripts/godot.sh --path . -s tools/screenshot.gd
## Optionally override the scene: -- res://scenes/other.tscn . Output: user://shot.png

const DEFAULT_SCENE := "res://scenes/arena_test.tscn"
const CAPTURE_FRAME := 90
const OUT := "user://shot.png"

var _frames := 0

func _initialize() -> void:
	var scene_path := DEFAULT_SCENE
	var extra := OS.get_cmdline_user_args()
	if extra.size() > 0:
		scene_path = extra[0]
	if extra.size() > 1:
		var g := root.get_node_or_null("Game")   # autoload node (not a compile-time global here)
		if g != null:
			g.selected_map = extra[1]
	root.add_child(load(scene_path).instantiate())

func _process(_delta: float) -> bool:
	_frames += 1
	if _frames == CAPTURE_FRAME:
		root.get_texture().get_image().save_png(OUT)
		print("SHOT_SAVED ", ProjectSettings.globalize_path(OUT))
	return _frames > CAPTURE_FRAME
