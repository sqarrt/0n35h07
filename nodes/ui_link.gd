class_name UiLink extends Button
## A text link — port of web theme.css `.about-link`: 0.95rem accent-dim spaced 0.06em as wide as its text over a 1 px
## bottom border, transparent until hovered, when the text turns accent and the border accent-dim. Opens `href`.

signal opened(href: String)

const FONT_PX := 15.2                     # 0.95rem
const SPACING_EM := 0.06
const BORDER_PX := 1
const IDLE_STATES := ["normal", "disabled", "focus"]
const HOVER_STATES := ["hover", "pressed", "hover_pressed"]
const HOVER_COLORS := ["font_hover_color", "font_pressed_color", "font_hover_pressed_color"]

var href := ""

func _init(caption := "", link := "") -> void:
	text = caption
	href = link
	focus_mode = Control.FOCUS_NONE
	alignment = HORIZONTAL_ALIGNMENT_LEFT
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var font_size := UiFont.css_size(FONT_PX)
	var font := UiFont.with_css_line(UiFont.spaced(SPACING_EM, font_size, FONT_PX), font_size, FONT_PX)
	add_theme_font_override("font", font)
	add_theme_font_size_override("font_size", font_size)
	add_theme_color_override("font_color", UiTokens.ACCENT_DIM)
	add_theme_color_override("font_focus_color", UiTokens.ACCENT_DIM)
	for key in HOVER_COLORS:
		add_theme_color_override(key, UiTokens.ACCENT)
	for state in IDLE_STATES:
		add_theme_stylebox_override(state, _box(Color.TRANSPARENT, font.spacing_glyph))
	for state in HOVER_STATES:
		add_theme_stylebox_override(state, _box(UiTokens.ACCENT_DIM, font.spacing_glyph))
	pressed.connect(func() -> void: opened.emit(href))

func _box(border: Color, trailing_spacing: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.draw_center = false
	box.border_color = border
	box.border_width_bottom = BORDER_PX
	box.anti_aliasing = false
	box.content_margin_bottom = BORDER_PX
	box.content_margin_right = trailing_spacing
	return box
