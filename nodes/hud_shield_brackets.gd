class_name HudShieldBrackets extends Control
## Shield corner brackets — port of web ShieldBrackets.tsx: four 90px L-brackets 20px from the screen corners.
## A dim track shows the full L; the coloured arms grow from the corner vertex as the shield recharges.
## Arms are drawn as non-overlapping rects so semi-transparent colour isn't doubled at the vertex
## (web applies the opacity to the arm group).

const EDGE := 20.0                    # web container inset from the screen edge
const INSET := 4.0                    # web M: vertex inset inside the 90px box
const STROKE := 6.0
const HALF := STROKE / 2.0
const CAP := HALF                     # web strokeLinecap="square" extends an arm by half the stroke
const TRACK_COLOR := Color("#222233")
const TRACK_OPACITY := 0.4
# Corner direction: +1 grows right/down from the vertex, -1 grows left/up (tl, tr, bl, br).
const CORNERS := [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]

var _progress := 1.0
var _active := false

func _ready() -> void:
	name = "ShieldBrackets"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

func set_state(progress: float, active: bool) -> void:
	var p := clampf(progress, 0.0, HudModel.READY)
	if p != _progress or active != _active:
		_progress = p
		_active = active
		queue_redraw()

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		queue_redraw()

func _draw() -> void:
	var look := HudModel.shield_bracket_look(_progress, _active)
	var arm_color: Color = look["color"]
	arm_color.a = look["opacity"]
	var track := Color(TRACK_COLOR, TRACK_OPACITY)
	var length: float = look["length"]
	for dir in CORNERS:
		var vertex := _vertex(dir)
		for rect in arm_rects(vertex, dir, HudModel.BRACKET_ARM, 0.0):
			draw_rect(rect, track)
		if length > 0.0:
			for rect in arm_rects(vertex, dir, length, CAP):
				draw_rect(rect, arm_color)

## The rects of one L: the horizontal arm owns the band through the vertex, the vertical arm starts past it.
## `cap` = CAP for square-capped arms (web fill), 0 for butt ends (web track, which needs a small notch rect).
static func arm_rects(vertex: Vector2, dir: Vector2, length: float, cap: float) -> Array:
	var rects: Array = [
		_rect(Vector2(vertex.x - dir.x * cap, vertex.y - HALF), Vector2(vertex.x + dir.x * (length + cap), vertex.y + HALF)),
		_rect(Vector2(vertex.x - HALF, vertex.y + dir.y * HALF), Vector2(vertex.x + HALF, vertex.y + dir.y * (length + cap))),
	]
	if cap < HALF:   # butt ends: the vertical arm still covers its half of the band outside the horizontal arm
		rects.append(_rect(Vector2(vertex.x - dir.x * HALF, vertex.y - dir.y * cap), Vector2(vertex.x - dir.x * cap, vertex.y + dir.y * HALF)))
	return rects

static func _rect(a: Vector2, b: Vector2) -> Rect2:
	return Rect2(a, b - a).abs()

func _vertex(dir: Vector2) -> Vector2:
	return vertex_for(dir, size)

# The web renders each bracket as an inline <svg> inside a div, which leaves a descender gap under the svg:
# bottom-anchored brackets therefore sit this much higher than the plain box maths (measured on the GPU frame).
const WEB_BASELINE_GAP := 4.0

## The corner vertex in screen space: the box sits EDGE from the corner, the vertex INSET inside it.
static func vertex_for(dir: Vector2, screen: Vector2) -> Vector2:
	var offset := EDGE + INSET
	var x := offset if dir.x > 0 else screen.x - offset
	var y := offset if dir.y > 0 else screen.y - offset - WEB_BASELINE_GAP
	return Vector2(x, y)
