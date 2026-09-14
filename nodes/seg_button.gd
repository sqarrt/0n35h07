class_name SegButton extends Button
## A segment toggle — port of web theme.css `.seg`: the tracked 11 px label in a 1 px #334 box, brighter under the
## mouse; `seg--on` turns it accent with a faint accent fill. The SMALL size is the bot difficulty picker's
## (`.seat-diff .seg`: 9 px, 3 / 8 px padding).

const NORMAL := "normal"
const SMALL := "small"
const FONT_SIZES := {NORMAL: 11, SMALL: 9}
const PADDING := {NORMAL: Vector2(11.0, 5.0), SMALL: Vector2(8.0, 3.0)}   # padding: <y> <x>
const LETTER_SPACING_EM := 0.08
const BORDER_PX := 1
const IDLE_BORDER := Color("#333344")                 # border: 1px solid #334
const HOVER_TEXT := Color("#bcd6ee")                  # .seg:hover color
const ON_BACKGROUND := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.1)   # .seg--on background
## [background, border, text] per look.
const IDLE_LOOK := [Color.TRANSPARENT, IDLE_BORDER, UiTokens.MUTED]
const HOVER_LOOK := [Color.TRANSPARENT, UiTokens.GHOST_LINE_HOVER, HOVER_TEXT]
const ON_LOOK := [ON_BACKGROUND, UiTokens.ACCENT, UiTokens.ACCENT]
const BACKGROUND := 0
const BORDER := 1
const TEXT := 2
const STATE_COLORS := {"normal": "font_color", "hover": "font_hover_color", "pressed": "font_pressed_color",
	"hover_pressed": "font_hover_pressed_color", "disabled": "font_disabled_color"}

var size_variant := NORMAL

var _on := false
var _spacing := 0

func _init(label := "", variant := NORMAL) -> void:
	text = label
	size_variant = variant
	focus_mode = Control.FOCUS_NONE
	var spacing_em := UiFont.control_spacing_em(LETTER_SPACING_EM)
	var font := UiFont.with_css_line(UiFont.spaced(spacing_em, FONT_SIZES[variant]), FONT_SIZES[variant])
	_spacing = font.spacing_glyph
	add_theme_font_override("font", font)
	add_theme_font_size_override("font_size", FONT_SIZES[variant])
	_apply()

func set_on(on: bool) -> void:
	if on == _on:
		return
	_on = on
	_apply()

func is_on() -> bool:
	return _on

## Web `.seg:hover` loses to `.seg--on` (declared later): an on segment keeps its look under the mouse.
func _apply() -> void:
	for state in STATE_COLORS:
		var look: Array = ON_LOOK if _on else (HOVER_LOOK if state in ["hover", "hover_pressed"] else IDLE_LOOK)
		add_theme_stylebox_override(state, _box(look[BACKGROUND], look[BORDER]))
		add_theme_color_override(STATE_COLORS[state], look[TEXT])
	add_theme_color_override("font_focus_color", (ON_LOOK if _on else IDLE_LOOK)[TEXT])

func _box(background: Color, border: Color) -> StyleBoxFlat:
	var padding: Vector2 = PADDING[size_variant]
	var box := StyleBoxFlat.new()
	box.bg_color = background
	box.border_color = border
	box.set_border_width_all(BORDER_PX)
	box.anti_aliasing = false
	box.content_margin_left = padding.x + BORDER_PX
	box.content_margin_right = padding.x + BORDER_PX + _spacing   # Chrome's trailing letter spacing
	box.content_margin_top = padding.y + BORDER_PX
	box.content_margin_bottom = padding.y + BORDER_PX
	return box
