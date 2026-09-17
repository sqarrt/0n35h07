extends SceneTree
## Dev probe: how Godot rasterises the AudioBar stroke against the web's 2.5 px SVG line. Horizontal polylines at the
## silence rest height in several variants are drawn over the frame's dark background, saved to a PNG, and the blue
## channel around the line is printed per variant (web silence capture: 683:210 684:255 685:221).
##   <godot> --resolution 1280x720 -s tools/line_probe.gd -- [output png]

const DEFAULT_OUT := "res://test-results/probes/audio/line_probe.png"
const REST_Y := 684.53                       # web silence line centre on screen
const BACKGROUND := Color("#0a0c11")
const COLOR := Color("#4af")
const SEGMENT := 60.0
const START_X := 40.0
const STEP_X := 200.0
const SAMPLE_OFFSET := 30.0
const ROW_FROM := 681
const ROW_TO := 688
const SETTLE_FRAMES := 3
const HALF := 0.5
## [name, width, antialiased, round-join circles]
const VARIANTS := [["aa+circles", 2.5, true, true], ["aa", 2.5, true, false], ["no-aa", 2.5, false, false],
	["aa 2.0", 2.0, true, false], ["aa 1.5", 1.5, true, false], ["no-aa+circles", 2.5, false, true]]

class Canvas extends Control:
	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), BACKGROUND)
		for i in VARIANTS.size():
			var variant: Array = VARIANTS[i]
			var x0: float = START_X + i * STEP_X
			var points := PackedVector2Array([Vector2(x0, REST_Y), Vector2(x0 + SEGMENT, REST_Y),
				Vector2(x0 + 2.0 * SEGMENT, REST_Y)])
			draw_polyline(points, COLOR, variant[1], variant[2])
			if variant[3]:
				for point in points:
					draw_circle(point, variant[1] * HALF, COLOR, true, -1.0, variant[2])

var _out := DEFAULT_OUT
var _frames := 0
var _capturing := false

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if not args.is_empty():
		_out = args[0]
	var canvas := Canvas.new()
	canvas.size = Vector2(1280.0, 720.0)
	root.add_child(canvas)

func _process(_delta: float) -> bool:
	_frames += 1
	if _frames >= SETTLE_FRAMES and not _capturing:
		_capturing = true
		_capture()
	return false

func _capture() -> void:
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out.get_base_dir()))
	image.save_png(_out)
	for i in VARIANTS.size():
		var x := int(START_X + i * STEP_X + SAMPLE_OFFSET)
		var profile := []
		for y in range(ROW_FROM, ROW_TO + 1):
			profile.append("%d:%d" % [y, roundi(image.get_pixel(x, y).b8)])
		print("LINE %-14s %s" % [VARIANTS[i][0], " ".join(profile)])
	quit()
