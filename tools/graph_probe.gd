extends SceneTree
## Dev probe: the stats graph's frame-time line drawn as one polyline, as separate segments, or as a polyline plus
## separate segments at each apex, over the web capture's readings (a 22 ms spike at frame 40, a 12 ms one at frame
## 100), printing the blue channel around the tall spike and along a flat stretch.
##   <godot> --resolution 1280x720 -s tools/graph_probe.gd

const HISTORY := 150
const BASE_MS := 6.9
const SPIKES := {40: 22.0, 100: 12.0}
const SPIKE := 40
const ROW_FROM := 150
const ROW_TO := 176
const ROW_STEP := 1
const FLAT := 70
const FLAT_ROW_FROM := 172
const FLAT_ROW_TO := 177
const COLUMN_SPAN := 2
const SETTLE_FRAMES := 3
const VARIANTS := ["polyline", "segments", "polyline+apex"]

class Canvas extends Control:
	var times := PackedFloat32Array()
	var origins: Array = []

	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), Color("#0a0c11"))
		for variant in origins.size():
			var origin: Vector2 = origins[variant]
			var points := PackedVector2Array()
			for i in times.size():
				points.append(origin + Vector2(float(i), StatsModel.graph_y(times[i])))
			if variant == 1:
				for i in range(1, points.size()):
					draw_line(points[i - 1], points[i], HudStatsOverlay.COLOR, HudStatsOverlay.LINE_PX, true)
				continue
			draw_polyline(points, HudStatsOverlay.COLOR, HudStatsOverlay.LINE_PX, true)
			if variant == 2:
				for i in range(1, points.size() - 1):
					var apex := (points[i].y < points[i - 1].y and points[i].y < points[i + 1].y) \
						or (points[i].y > points[i - 1].y and points[i].y > points[i + 1].y)
					if apex:
						draw_line(points[i - 1], points[i], HudStatsOverlay.COLOR, HudStatsOverlay.LINE_PX, true)
						draw_line(points[i], points[i + 1], HudStatsOverlay.COLOR, HudStatsOverlay.LINE_PX, true)

var _origins := [Vector2(22.0, 139.0), Vector2(422.0, 139.0), Vector2(822.0, 139.0)]   # Chrome composites the canvas at y 139
const OUT := "res://test-results/probes/audio/graph_probe.png"
var _frames := 0
var _capturing := false

func _initialize() -> void:
	var canvas := Canvas.new()
	canvas.size = Vector2(1280.0, 720.0)
	canvas.origins = _origins
	canvas.times.resize(HISTORY)
	for i in HISTORY:
		canvas.times[i] = SPIKES.get(i, BASE_MS)
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
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT.get_base_dir()))
	image.save_png(OUT)
	for variant in _origins.size():
		var x0 := int(_origins[variant].x) + SPIKE
		print("GRAPH %s (columns %d..%d)" % [VARIANTS[variant], x0 - COLUMN_SPAN, x0 + COLUMN_SPAN])
		for y in range(ROW_FROM, ROW_TO + 1, ROW_STEP):
			var row := []
			for x in range(x0 - COLUMN_SPAN, x0 + COLUMN_SPAN + 1):
				row.append("%3d" % roundi(image.get_pixel(x, y).b8))
			print("   y%d: %s" % [y, " ".join(row)])
		var flat_x := int(_origins[variant].x) + FLAT
		var flat := []
		for y in range(FLAT_ROW_FROM, FLAT_ROW_TO + 1):
			flat.append("%d:%d" % [y, roundi(image.get_pixel(flat_x, y).b8)])
		print("   flat x+%d: %s" % [FLAT, " ".join(flat)])
	quit()
