class_name HudGhostIndicator extends Control
## Ghost-phase indicator — port of the web RespawnOverlay bars and label: #9cf bars 6px thick, 21px from the top and
## bottom, centred and shrinking with the remaining phase (width = progress × 50%), glowing; "RESPAWNING" in small
## tracked caps 120px above the screen centre. The edge vignette lives in HudOverlayFx.

const COLOR := Color("#99ccff")              # web GHOST #9cf
const TEXT := "RESPAWNING"                   # web dictionary respawning
const INSET := 21.0                          # web HUD_FRAME_INSET
const THICKNESS := 6.0
const GLOW := 10.0                           # web box-shadow 0 0 10px
const GLOW_ALPHA := 0.35
const FONT_SIZE := 12                        # web 0.75rem
const SPACING_EM := 0.25
const LABEL_RAISE := 120.0                   # web translateY(-120px) from the centre
const LABEL_GLOW_ALPHA := 0.5                # web text-shadow 0 0 8px (approximated, no blur)
const LABEL_GLOW_OUTLINE := 4

var _progress := 0.0
var _label: Label

func _ready() -> void:
	name = "GhostIndicator"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false
	_label = Label.new()
	_label.name = "Label"
	_label.text = TEXT
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_label.offset_top = -LABEL_RAISE
	_label.offset_bottom = -LABEL_RAISE
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_label.add_theme_font_override("font", UiFont.spaced(SPACING_EM, FONT_SIZE))
	_label.add_theme_font_size_override("font_size", FONT_SIZE)
	_label.add_theme_color_override("font_color", COLOR)
	_label.add_theme_color_override("font_shadow_color", Color(COLOR, LABEL_GLOW_ALPHA))
	_label.add_theme_constant_override("shadow_outline_size", LABEL_GLOW_OUTLINE)
	_label.add_theme_constant_override("shadow_offset_x", 0)
	_label.add_theme_constant_override("shadow_offset_y", 0)
	add_child(_label)

## Show the indicator with the remaining share of the ghost phase (web progress runs 1 -> 0).
func show_progress(progress: float) -> void:
	_progress = clampf(progress, 0.0, HudModel.READY)
	visible = true
	queue_redraw()

func hide_indicator() -> void:
	visible = false

func bar_width() -> float:
	return size.x * HudModel.ghost_bar_width_share(_progress)

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		queue_redraw()

func _draw() -> void:
	var width := bar_width()
	if width <= 0.0:
		return
	var x := (size.x - width) / 2.0
	var glow := Color(COLOR, GLOW_ALPHA)
	for y in [INSET, size.y - INSET - THICKNESS]:
		draw_rect(Rect2(x - GLOW / 2.0, y - GLOW / 2.0, width + GLOW, THICKNESS + GLOW), glow)
		draw_rect(Rect2(x, y, width, THICKNESS), COLOR)
