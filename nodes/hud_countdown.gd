class_name HudCountdown extends Control
## Pre-fight countdown — port of web CountdownOverlay.tsx: a dim full-screen veil and a big bold glowing number that
## pops in (cdPop: scale 1.6 -> 1, opacity 0 -> 1 -> 0.9 over 1 s, ease-out), restarting for every new number.
## Godot label shadows can't blur, so the 40px glow is approximated by a faint halo.

const FONT_SIZE := 144                                         # web 9rem
const COLOR := Color("#44aaff")                                # web #4af
const DIM_COLOR := Color(10.0 / 255.0, 10.0 / 255.0, 15.0 / 255.0, 0.35)   # web rgba(10,10,15,0.35)
const EMBOLDEN := 0.8                                          # web fontWeight: bold (synthesised like the browser)
const GLOW_COLOR := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.6)          # web text-shadow rgba(68,170,255,0.6)
const GLOW_ALPHA := 0.35                                       # faint halo standing in for the 40px blur
const GLOW_OUTLINE := 12
const POP_DURATION_S := 1.0                                    # web cdPop 1s

var _dim: ColorRect
var _number: Label
var _elapsed := 0.0

func _ready() -> void:
	name = "Countdown"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dim = ColorRect.new()
	_dim.name = "Dim"
	_dim.color = DIM_COLOR
	_dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_dim)
	_number = Label.new()
	_number.name = "Number"
	_number.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_number.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_number.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_number.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var bold := FontVariation.new()
	bold.base_font = UiFont.base()
	bold.variation_embolden = EMBOLDEN
	_number.add_theme_font_override("font", bold)
	_number.add_theme_font_size_override("font_size", FONT_SIZE)
	_number.add_theme_color_override("font_color", COLOR)
	_number.add_theme_color_override("font_shadow_color", Color(GLOW_COLOR, GLOW_COLOR.a * GLOW_ALPHA))
	_number.add_theme_constant_override("shadow_outline_size", GLOW_OUTLINE)
	_number.add_theme_constant_override("shadow_offset_x", 0)
	_number.add_theme_constant_override("shadow_offset_y", 0)
	add_child(_number)
	_apply()

## Show a countdown number; a different number restarts the pop (web re-keys the element per number).
func set_number(text: String) -> void:
	if text != _number.text:
		_number.text = text
		_elapsed = 0.0
	_apply()

func tick(delta: float) -> void:
	_elapsed += delta
	_apply()

func _apply() -> void:
	var pop := HudModel.countdown_pop(_elapsed / POP_DURATION_S)
	_number.pivot_offset = _number.size / 2.0
	_number.scale = Vector2.ONE * float(pop["scale"])
	_number.modulate.a = pop["opacity"]
