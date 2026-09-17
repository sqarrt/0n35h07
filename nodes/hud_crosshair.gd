class_name HudCrosshair extends Control
## Crosshair — port of web Crosshair.tsx: a 40px ring (r = 14, stroke 2) whose arc shows the beam cooldown, drawn
## clockwise from the top over a dim track, with a white "+" in the middle.

const BOX := 40.0
const RADIUS := 14.0
const STROKE := 2.0
const TRACK_COLOR := Color(0.2, 0.2, 0.2, 0.6)   # web #333 at opacity 0.6
const ARC_POINTS := 64
const START_ANGLE := -PI / 2.0                   # 12 o'clock (web rotate(-90))
const PLUS_TEXT := "+"
const PLUS_FONT_SIZE := 16
const PLUS_SHADOW := 2                           # web drop-shadow(0 0 2px black)

var _progress := 1.0

func _ready() -> void:
	name = "Crosshair"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_CENTER)
	offset_left = -BOX / 2.0
	offset_top = -BOX / 2.0
	offset_right = BOX / 2.0
	offset_bottom = BOX / 2.0
	var plus := Label.new()
	plus.text = PLUS_TEXT
	plus.set_anchors_preset(Control.PRESET_FULL_RECT)
	plus.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	plus.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	plus.add_theme_font_override("font", UiFont.base())
	plus.add_theme_font_size_override("font_size", PLUS_FONT_SIZE)
	plus.add_theme_color_override("font_color", Color.WHITE)
	plus.add_theme_color_override("font_shadow_color", Color.BLACK)
	plus.add_theme_constant_override("shadow_outline_size", PLUS_SHADOW)
	add_child(plus)

func set_progress(progress: float) -> void:
	var p := clampf(progress, 0.0, HudModel.READY)
	if p != _progress:
		_progress = p
		queue_redraw()

func _draw() -> void:
	var center := Vector2(BOX, BOX) / 2.0
	draw_arc(center, RADIUS, 0.0, TAU, ARC_POINTS, TRACK_COLOR, STROKE, true)
	if _progress <= 0.0:
		return
	var color := HudModel.crosshair_ring_color(_progress)
	var end_angle := START_ANGLE + TAU * _progress
	draw_arc(center, RADIUS, START_ANGLE, end_angle, ARC_POINTS, color, STROKE, true)
	# web strokeLinecap="round": cap both ends of the arc
	for angle in [START_ANGLE, end_angle]:
		draw_circle(center + Vector2.from_angle(angle) * RADIUS, STROKE / 2.0, color)
