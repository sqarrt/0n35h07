extends SceneTree
## Dev tool: light/tonemap calibration against real-GPU web frames. Loads the arena with a passive bot, warms up,
## then renders the same view once per tonemapper and saves one PNG each. Needs a real rendering context.
##   --path . -s tools/calibrate_lights.gd -- <raw map> <output dir>
## Measure the results with: python3 tools/parity/measure.py <output dir>/tonemap-*.png

const SCENE := "res://scenes/arena_test.tscn"
const WARMUP_FRAMES := 300        # countdown + scene settle before the first capture
const SETTLE_FRAMES := 20         # frames after switching the tonemapper
const HUMAN_ID := 0
const ARG_MAP := 0
const ARG_OUT_DIR := 1
const TONEMAPPERS := {
	"linear": Environment.TONE_MAPPER_LINEAR,
	"reinhard": Environment.TONE_MAPPER_REINHARDT,
	"filmic": Environment.TONE_MAPPER_FILMIC,
	"aces": Environment.TONE_MAPPER_ACES,
	"agx": Environment.TONE_MAPPER_AGX,
}

var _out_dir := ""
var _frames := 0
var _names: Array = TONEMAPPERS.keys()
var _index := -1
var _switched_at := 0
var _busy := false
var _done := false

func _initialize() -> void:
	var extra := OS.get_cmdline_user_args()
	var g := root.get_node_or_null("Game")
	if g != null:
		g.selected_map = extra[ARG_MAP]
	_out_dir = extra[ARG_OUT_DIR]
	root.add_child(load(SCENE).instantiate())
	_make_bot_passive.call_deferred()

func _make_bot_passive() -> void:
	for node in root.find_children("*", "", true, false):
		if node is PlayerNode and node.player.id != HUMAN_ID:
			node.controller = null

func _process(_delta: float) -> bool:
	_frames += 1
	if _done or _busy or _frames < WARMUP_FRAMES:
		return _done
	if _index < 0 or _frames - _switched_at >= SETTLE_FRAMES:
		if _index >= 0:
			_busy = true
			_capture(_names[_index])
		else:
			_next()
	return _done

func _next() -> void:
	_index += 1
	if _index >= _names.size():
		_done = true
		return
	var env := (root.find_child("Environment", true, false) as WorldEnvironment).environment
	env.tonemap_mode = TONEMAPPERS[_names[_index]]
	_switched_at = _frames

func _capture(variant: String) -> void:
	await RenderingServer.frame_post_draw
	var path := "%s/tonemap-%s.png" % [_out_dir, variant]
	if root.get_texture().get_image().save_png(path) != OK:
		push_error("Calibration capture failed: %s" % path)
	print("CALIBRATION_SAVED ", ProjectSettings.globalize_path(path))
	_busy = false
	_next()
