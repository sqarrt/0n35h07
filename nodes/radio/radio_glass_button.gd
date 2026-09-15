class_name RadioGlassButton extends Control
## A glass bar button of the expanded Radio player — web RadioPlayer backBtn: a glass.ts card, padding 9px 0, the label
## centred in #cdd at 0.74rem spaced 0.16em. Its line box holds the fallback face of the label's symbol (the ← Chrome
## takes from Microsoft YaHei), so the bar is the two borders, the padding and that mixed line.

signal pressed

const PADDING_Y := 9.0
const LABEL_PX := 11.84                         # 0.74rem
const SPACING_EM := 0.16
const TEXT := Color("#ccdddd")                  # #cdd
const SYMBOL_FAMILIES := ["Microsoft YaHei"]   # the --ui-font stack's face for ←
const HALF := 0.5

var _glass: GlassCard
var _button: CssButton

func _init(label: String) -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glass = GlassCard.new()
	add_child(_glass)
	_button = CssButton.new()
	_button.name = "Button"
	_button.focus_mode = Control.FOCUS_NONE
	_button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var box := StyleBoxEmpty.new()
	box.content_margin_top = GlassCard.BORDER_PX + PADDING_Y
	box.content_margin_bottom = GlassCard.BORDER_PX + PADDING_Y
	RadioButtons.dress(_button, box, TEXT)
	RadioButtons.set_font(_button, LABEL_PX, SPACING_EM, SYMBOL_FAMILIES)
	_button.alignment = HORIZONTAL_ALIGNMENT_CENTER
	_button.css_baseline = GlassCard.BORDER_PX + PADDING_Y + UiFont.fallback_ascent_px(LABEL_PX, SYMBOL_FAMILIES)
	_button.text = label
	_button.pressed.connect(func() -> void: pressed.emit())
	add_child(_button)
	resized.connect(_layout)

func button() -> CssButton:
	return _button

## The bar's height: both borders, the padding and the label's mixed line box.
func bar_height() -> float:
	return 2.0 * (GlassCard.BORDER_PX + PADDING_Y) + UiFont.fallback_line_px(LABEL_PX, SYMBOL_FAMILIES)

func _get_minimum_size() -> Vector2:
	return Vector2(0.0, bar_height())

func _layout() -> void:
	_glass.set_box(size)
	_button.position = Vector2.ZERO
	_button.size = size
