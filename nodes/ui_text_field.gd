class_name UiTextField extends LineEdit
## Text input — port of web theme.css `.input` as the settings name field styles it: transparent inside a 1 px line
## border that turns into a 2 px accent ring while focused (the accent border plus a 1 px inset shadow), the text
## colour at 1.3rem spaced 0.1em, 0.5rem / 1rem padding, 16rem wide including the padding and border.

const FONT_PX := 20.8                     # 1.3rem
const SPACING_EM := 0.1
const PADDING := Vector2(16.0, 8.0)       # padding: 0.5rem 1rem
const WIDTH := 256.0                      # 16rem, border-box
const BORDER_PX := 1
const FOCUS_RING_PX := 2                  # border 1px accent + box-shadow inset 1px accent

func _init(initial := "", max_chars := 0) -> void:
	text = initial
	max_length = max_chars
	caret_blink = true
	custom_minimum_size.x = WIDTH
	var font_size := UiFont.css_size(FONT_PX)
	var font := UiFont.with_css_line(UiFont.spaced(SPACING_EM, font_size, FONT_PX), font_size, FONT_PX)
	add_theme_font_override("font", font)
	add_theme_font_size_override("font_size", font_size)
	add_theme_color_override("font_color", UiTokens.TEXT)
	add_theme_color_override("caret_color", UiTokens.TEXT)
	add_theme_stylebox_override("normal", _box(UiTokens.LINE, BORDER_PX))
	add_theme_stylebox_override("read_only", _box(UiTokens.LINE, BORDER_PX))
	add_theme_stylebox_override("focus", _box(UiTokens.ACCENT, FOCUS_RING_PX))

func _box(color: Color, width: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.draw_center = false
	box.border_color = color
	box.set_border_width_all(width)
	box.anti_aliasing = false
	box.content_margin_left = PADDING.x + BORDER_PX
	box.content_margin_right = PADDING.x + BORDER_PX
	box.content_margin_top = PADDING.y + BORDER_PX
	box.content_margin_bottom = PADDING.y + BORDER_PX
	return box
