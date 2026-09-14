class_name HudCountdown extends Control
## Pre-fight countdown — port of web CountdownOverlay.tsx: a dim full-screen veil and a big bold number with a blurred
## 40px glow (GlowText) that pops in (cdPop: scale 1.6 -> 1, opacity 0 -> 1 -> 0.9 over 1 s, ease-out), restarting
## for every new number.

const FONT_SIZE := 144                                         # web 9rem
const COLOR := Color("#44aaff")                                # web #4af
const DIM_COLOR := Color(10.0 / 255.0, 10.0 / 255.0, 15.0 / 255.0, 0.35)   # web rgba(10,10,15,0.35)
const EMBOLDEN := 0.8                                          # web fontWeight: bold (synthesised like the browser)
const GLOW_COLOR := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.6)          # web text-shadow rgba(68,170,255,0.6)
const GLOW_BLUR := 40.0                                        # web text-shadow 0 0 40px
const POP_DURATION_S := 1.0                                    # web cdPop 1s
const HALF := 0.5

var _dim: ColorRect
var _number: GlowText
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
	var center := CenterContainer.new()
	center.name = "Center"
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	_number = GlowText.new()
	_number.name = "Number"
	center.add_child(_number)
	var bold := FontVariation.new()
	bold.base_font = UiFont.base()
	bold.variation_embolden = EMBOLDEN
	UiFont.mirror_fallbacks(bold)
	_number.configure(bold, FONT_SIZE, COLOR)
	_number.set_shadows([CssShadow.make(GLOW_BLUR, GLOW_COLOR)])
	_apply()

## Show a countdown number; a different number restarts the pop (web re-keys the element per number).
func set_number(text: String) -> void:
	if text != _number.label().text:
		_number.set_text(text)
		_elapsed = 0.0
	_apply()

func tick(delta: float) -> void:
	_elapsed += delta
	_apply()

func _apply() -> void:
	var pop := HudModel.countdown_pop(_elapsed / POP_DURATION_S)
	_number.pivot_offset = _number.get_combined_minimum_size() * HALF
	_number.scale = Vector2.ONE * float(pop["scale"])
	_number.modulate.a = pop["opacity"]
