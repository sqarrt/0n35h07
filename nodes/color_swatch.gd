class_name ColorSwatch extends Button
## A colour swatch — port of web theme.css `.swatch`: a 32 px circle of its colour inside a 2 px #223 ring; selected
## (`.swatch--sel`), a 3 px text-colour ring with a 10 px glow of its own colour (`box-shadow: 0 0 10px currentColor`);
## dimmed (`.swatch--dis`) at 25% opacity; 8% larger under the mouse (`transform: scale(1.08)`, no transition).

const SIZE := 32.0
const BORDER_PX := 2.0
const SELECTED_BORDER_PX := 3.0
const BORDER_COLOR := Color("#222233")
const GLOW_BLUR := 10.0
const GLOW_SIGMAS := 3.0                   # the glow node reaches three sigmas past the box
const HOVER_SCALE := 1.08
const DIMMED_OPACITY := 0.25
const SHADER := preload("res://assets/shaders/color_swatch.gdshader")
const STATES := ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]
const HALF := 0.5

var color := Color.WHITE
var selected := false
var dimmed := false

var _paint: ColorRect
var _material: ShaderMaterial

func _init(swatch_color := Color.WHITE) -> void:
	color = swatch_color
	focus_mode = Control.FOCUS_NONE
	custom_minimum_size = Vector2(SIZE, SIZE)
	for state in STATES:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	_material = ShaderMaterial.new()
	_material.shader = SHADER
	_paint = ColorRect.new()
	_paint.name = "Paint"
	_paint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_paint.material = _material
	add_child(_paint)
	mouse_entered.connect(_set_hovered.bind(true))
	mouse_exited.connect(_set_hovered.bind(false))
	_apply()

func set_selected(on: bool) -> void:
	selected = on
	_apply()

func set_dimmed(on: bool) -> void:
	dimmed = on
	_apply()

func glow_pad() -> float:
	return GLOW_BLUR * HALF * GLOW_SIGMAS

func _apply() -> void:
	var pad := glow_pad()
	_paint.position = -Vector2(pad, pad)
	_paint.size = Vector2(SIZE, SIZE) + 2.0 * Vector2(pad, pad)
	_material.set_shader_parameter("box_px", Vector2(SIZE, SIZE))
	_material.set_shader_parameter("pad_px", pad)
	_material.set_shader_parameter("sigma", GLOW_BLUR * HALF if selected else 0.0)
	_material.set_shader_parameter("ring_px", SELECTED_BORDER_PX if selected else BORDER_PX)
	_material.set_shader_parameter("fill_color", color)
	_material.set_shader_parameter("ring_color", UiTokens.TEXT if selected else BORDER_COLOR)
	_material.set_shader_parameter("glow_color", color)
	modulate.a = DIMMED_OPACITY if dimmed else 1.0

func _set_hovered(hovered: bool) -> void:
	pivot_offset = Vector2(SIZE, SIZE) * HALF
	scale = Vector2.ONE * (HOVER_SCALE if hovered else 1.0)
