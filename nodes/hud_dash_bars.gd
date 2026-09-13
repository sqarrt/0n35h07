class_name HudDashBars extends Control
## Dash cooldown bars — port of web DashIndicator.tsx: two 6px vertical strips a third of the screen tall, 21px from
## the left and right edges, vertically centred; the fill grows from the centre as the dash recharges.

const INSET := 21.0                           # web HUD_FRAME_INSET
const WIDTH := 6.0
const HEIGHT_SHARE := 1.0 / 3.0               # web calc(100vh / 3)
const TRACK_COLOR := Color(1, 1, 1, 0.05)     # web rgba(255,255,255,0.05)

var _progress := 1.0

func _ready() -> void:
	name = "DashBars"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)   # anchors alone leave a 0x0 rect

func set_progress(progress: float) -> void:
	var p := clampf(progress, 0.0, HudModel.READY)
	if p != _progress:
		_progress = p
		queue_redraw()

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		queue_redraw()

func _draw() -> void:
	var look := HudModel.dash_bar_look(_progress)
	var fill_color: Color = look["color"]
	fill_color.a = look["opacity"]
	var strip_h := size.y * HEIGHT_SHARE
	var top := (size.y - strip_h) / 2.0
	var fill_h := strip_h * float(look["fill"])
	for x in [INSET, size.x - INSET - WIDTH]:
		draw_rect(Rect2(x, top, WIDTH, strip_h), TRACK_COLOR)
		if fill_h > 0.0:
			draw_rect(Rect2(x, top + (strip_h - fill_h) / 2.0, WIDTH, fill_h), fill_color)
