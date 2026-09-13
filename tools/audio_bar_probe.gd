extends SceneTree
## Dev probe: the AudioBar's layers in isolation. A resting HudAudioBar (silence) on the frame's dark background is saved
## whole, with only its line and with only its glow; the blue channel at a flat spot is printed for each, to compare the
## stroke and the drop-shadow separately with the web capture.
##   <godot> --resolution 1280x720 -s tools/audio_bar_probe.gd -- [output dir]

const DEFAULT_OUT := "res://test-results/probes/audio"
const BACKGROUND := Color("#0a0c11")
const SAMPLE_X := 360
const ROW_FROM := 675
const ROW_TO := 693
const SETTLE_FRAMES := 5
const LAYERS := ["full", "line", "glow"]

var _out := DEFAULT_OUT
var _bar: HudAudioBar
var _frames := 0
var _capturing := false

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if not args.is_empty():
		_out = args[0]
	var background := ColorRect.new()
	background.color = BACKGROUND
	background.size = Vector2(1280.0, 720.0)
	root.add_child(background)
	_bar = HudAudioBar.new()
	_bar.size = Vector2(1280.0, 720.0)
	root.add_child(_bar)

func _process(_delta: float) -> bool:
	_frames += 1
	if _frames >= SETTLE_FRAMES and not _capturing:
		_capturing = true
		_capture()
	return false

func _capture() -> void:
	var silence := PackedFloat32Array()
	silence.resize(AudioBarModel.BANDS)
	_bar.tick(silence)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out))
	for layer in LAYERS:
		_bar.get_node("Glow").visible = layer != "line"
		_bar.get_node("Line").visible = layer != "glow"
		for i in SETTLE_FRAMES:
			await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		image.save_png(_out.path_join("audio_bar_%s.png" % layer))
		var profile := []
		for y in range(ROW_FROM, ROW_TO + 1):
			profile.append("%d:%d" % [y, roundi(image.get_pixel(SAMPLE_X, y).b8)])
		print("BAR %-5s %s" % [layer, " ".join(profile)])
	quit()
