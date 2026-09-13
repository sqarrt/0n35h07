class_name HudGhostIndicator extends Control
## Ghost-phase indicator — port of the web RespawnOverlay bars and label: #9cf bars 6px thick, 21px from the top and
## bottom, centred and shrinking with the remaining phase (width = progress × 50%), with a 10px box-shadow glow solved
## analytically (glow_rect shader); "RESPAWNING" in small tracked caps with an 8px blurred glow, its top edge 120px
## above the screen centre (web top: 50% + translateY(-120px)). The edge vignette lives in HudOverlayFx.

const GLOW_SHADER := preload("res://assets/shaders/glow_rect.gdshader")
const COLOR := Color("#99ccff")              # web GHOST #9cf
const TEXT := "RESPAWNING"                   # web dictionary respawning
const INSET := 21.0                          # web HUD_FRAME_INSET
const THICKNESS := 6.0
const GLOW_BLUR := 10.0                      # web box-shadow 0 0 10px
const FONT_SIZE := 12                        # web 0.75rem
const SPACING_EM := 0.25
const LABEL_RAISE := 120.0                   # web translateY(-120px) from top: 50%
const LABEL_GLOW_BLUR := 8.0                 # web text-shadow 0 0 8px
const HALF := 0.5
const BAR_NAMES := ["BarTop", "BarBottom"]

var _progress := 0.0
var _label: GlowText
var _bars: Array[ColorRect] = []

func _ready() -> void:
	name = "GhostIndicator"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false
	_label = GlowText.new()
	_label.name = "Label"
	add_child(_label)
	_label.configure(UiFont.spaced(SPACING_EM, FONT_SIZE), FONT_SIZE, COLOR)
	_label.set_text(TEXT)
	_label.set_shadows([CssShadow.make(LABEL_GLOW_BLUR, COLOR)])
	var glow_pad := float(CssShadow.reach_px(CssShadow.make(GLOW_BLUR, COLOR)))
	for bar_name in BAR_NAMES:
		var bar := ColorRect.new()
		bar.name = bar_name
		bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var material := ShaderMaterial.new()
		material.shader = GLOW_SHADER
		material.set_shader_parameter("pad_px", glow_pad)
		material.set_shader_parameter("sigma", CssShadow.sigma(GLOW_BLUR))
		material.set_shader_parameter("core_color", COLOR)
		material.set_shader_parameter("glow_color", COLOR)
		bar.material = material
		add_child(bar)
		_bars.append(bar)
	_layout()

## Show the indicator with the remaining share of the ghost phase (web progress runs 1 -> 0).
func show_progress(progress: float) -> void:
	_progress = clampf(progress, 0.0, HudModel.READY)
	visible = true
	_layout()

func hide_indicator() -> void:
	visible = false

func bar_width() -> float:
	return size.x * HudModel.ghost_bar_width_share(_progress)

func bars() -> Array[ColorRect]:
	return _bars

func label() -> GlowText:
	return _label

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_layout()

func _layout() -> void:
	if _label == null:
		return
	var label_size := _label.get_combined_minimum_size()
	_label.position = Vector2((size.x - label_size.x) * HALF, size.y * HALF - LABEL_RAISE)
	var width := bar_width()
	var tops := [INSET, size.y - INSET - THICKNESS]
	for i in _bars.size():
		var bar := _bars[i]
		var material := bar.material as ShaderMaterial
		var pad: float = material.get_shader_parameter("pad_px")
		bar.visible = width > 0.0
		bar.position = Vector2((size.x - width) * HALF - pad, tops[i] - pad)
		bar.size = Vector2(width, THICKNESS) + Vector2.ONE * 2.0 * pad
		material.set_shader_parameter("box_px", Vector2(width, THICKNESS))
