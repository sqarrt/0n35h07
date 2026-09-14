class_name HudStatsOverlay extends Control
## Debug stats in the HUD corner — port of web components/StatsOverlay.tsx: under the shield bracket (top 116, left 22)
## in the 13 px UI font, accent colour and a 6 px black glow; FPS with the worst frame of the last half second over a
## 150 x 46 frame-time graph (120 / 60 FPS guides), and the player's speed. Each text sits centred in the CSS line box
## (line-height 1.5); blocks are 3 px apart and land on whole pixels like Chrome's composited boxes.

const TOP := 116.0
const LEFT := 22.0
const FONT_SIZE := 13
const LINE_HEIGHT := 1.5
const LETTER_SPACING_EM := 0.08
const COLOR := Color("#4af")                             # web --accent
const SHADOW_BLUR_PX := 6.0
const SHADOW_COLOR := Color(0.0, 0.0, 0.0, 0.85)
const GAP_PX := 3.0
const GRAPH_BACKGROUND := Color(8.0 / 255.0, 12.0 / 255.0, 18.0 / 255.0, 0.55)
const GUIDE_COLOR := Color(120.0 / 255.0, 180.0 / 255.0, 1.0, 0.25)
const LINE_PX := 1.0
const HALF := 0.5

## The frame-time graph drawn like the web canvas: background, the two guides, then the frame-time line.
class Graph extends Control:
	var model: StatsModel

	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, Vector2(StatsModel.GRAPH_W, StatsModel.GRAPH_H)), HudStatsOverlay.GRAPH_BACKGROUND)
		for guide in [StatsModel.MS_120, StatsModel.MS_60]:
			var y := StatsModel.graph_y(guide)
			draw_line(Vector2(0.0, y), Vector2(StatsModel.GRAPH_W, y), HudStatsOverlay.GUIDE_COLOR, HudStatsOverlay.LINE_PX, true)
		# Separate segments, not one polyline: Godot's antialiased polyline joins cut a one-frame spike's tip, while the
		# canvas bevel keeps it.
		var history := model.history()
		for i in range(1, history.size()):
			draw_line(Vector2(float(i - 1), StatsModel.graph_y(history[i - 1])), Vector2(float(i), StatsModel.graph_y(history[i])),
				HudStatsOverlay.COLOR, HudStatsOverlay.LINE_PX, true)

var model := StatsModel.new()

var _show_fps := false
var _show_speed := false
var _fps_text: GlowText
var _graph: Graph
var _speed_text: GlowText
var _frozen := false                                     # a parity fixture holds its readings

func _ready() -> void:
	name = "StatsOverlay"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_fps_text = _text("FpsText")
	_graph = Graph.new()
	_graph.name = "Graph"
	_graph.model = model
	_graph.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_graph.size = Vector2(StatsModel.GRAPH_W, StatsModel.GRAPH_H)
	add_child(_graph)
	_speed_text = _text("SpeedText")
	set_flags(_show_fps, _show_speed)

## Which parts show (web showFps / showSpeed).
func set_flags(show_fps: bool, show_speed: bool) -> void:
	_show_fps = show_fps
	_show_speed = show_speed
	if _fps_text == null:
		return
	_fps_text.visible = show_fps
	_graph.visible = show_fps
	_speed_text.visible = show_speed
	_layout()

## One rendered frame: the FPS readings and the graph follow it while FPS shows.
func tick(frame_ms: float) -> void:
	if not _show_fps or _frozen:
		return
	model.push_frame(frame_ms)
	refresh()

func set_speed(speed: float) -> void:
	if _frozen:
		return
	_speed_text.set_text(StatsModel.speed_text(speed))
	_layout()

## Parity fixture (tool-only): show these readings (web __debugStats) and ignore live frames and speed from then on.
func show_fixture(fixed_fps: int, fixed_worst_ms: float, frame_times: PackedFloat32Array, speed: float) -> void:
	_frozen = false
	model.set_fixed(fixed_fps, fixed_worst_ms, frame_times)
	set_speed(speed)
	refresh()
	_frozen = true

## Re-read the model (after a tick or a fixture).
func refresh() -> void:
	_fps_text.set_text(model.fps_text())
	_graph.queue_redraw()
	_layout()

func fps_text() -> GlowText:
	return _fps_text

func graph() -> Control:
	return _graph

func speed_text() -> GlowText:
	return _speed_text

func _layout() -> void:
	var line_box := FONT_SIZE * LINE_HEIGHT
	var y := TOP
	if _show_fps:
		_place_text(_fps_text, y, line_box)
		y += line_box + GAP_PX
		_graph.position = Vector2(LEFT, CssPixel.snap(y))
		y += StatsModel.GRAPH_H + GAP_PX
	if _show_speed:
		_place_text(_speed_text, y, line_box)

## A text's baseline where Chrome paints it: the line box composited on a whole pixel, the glyph box centred in it
## (half-leading) and the baseline itself rounded to a pixel.
func _place_text(text: GlowText, box_top: float, line_box: float) -> void:
	var ascent := text.label().get_theme_font("font").get_ascent(FONT_SIZE)
	var baseline := CssPixel.snap(CssPixel.snap(box_top) + (line_box - text.size.y) * HALF + ascent)
	text.position = Vector2(LEFT, baseline - ascent)

func _text(node_name: String) -> GlowText:
	var text := GlowText.new()
	text.name = node_name
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(text)
	text.configure(UiFont.spaced(LETTER_SPACING_EM, FONT_SIZE), FONT_SIZE, COLOR)
	text.set_shadows([CssShadow.make(SHADOW_BLUR_PX, SHADOW_COLOR)])
	return text
