class_name RadioButtons
## The Radio player's button looks (web RadioPlayer iconBtn / airBtn / unlockBtn): `appearance: none` — one box for every
## state, no hover or pressed look — one text colour for all of them, and a CssButton label in the UI font with the
## system faces Chrome takes its symbols from.

const STATES := ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]
const TEXT_COLORS := ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color",
	"font_focus_color", "font_disabled_color"]
const BORDER_PX := 1

## Every state drawn by `box`, every text in `color`.
static func dress(button: Button, box: StyleBox, color: Color) -> void:
	for state in STATES:
		button.add_theme_stylebox_override(state, box)
	for key in TEXT_COLORS:
		button.add_theme_color_override(key, color)

## A 1 px rounded outline, filled when `fill` shows; `padding` (CSS px) becomes the content margins around the border.
static func outline(border: Color, radius: int, fill := Color(0.0, 0.0, 0.0, 0.0), padding := Vector2.ZERO) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.draw_center = fill.a > 0.0
	box.border_color = border
	box.set_border_width_all(BORDER_PX)
	box.set_corner_radius_all(radius)
	if padding != Vector2.ZERO:   # explicit content margins leave the border out: add it back
		box.content_margin_left = padding.x + BORDER_PX
		box.content_margin_right = padding.x + BORDER_PX
		box.content_margin_top = padding.y + BORDER_PX
		box.content_margin_bottom = padding.y + BORDER_PX
	return box

## The label's CSS font: `css_px` spaced `spacing_em`, glyphs the UI font lacks from system `families`; a
## `line_height_px` above 0 is an explicit CSS line-height (the strut centred), 0 is `line-height: normal`.
static func set_font(button: CssButton, css_px: float, spacing_em: float, families: Array, line_height_px := 0.0) -> void:
	var face: Font = UiFont.base_with(families) if not families.is_empty() else null
	var font_size := UiFont.css_size(css_px)
	button.add_theme_font_override("font", UiFont.with_css_line(UiFont.spaced(spacing_em, font_size, css_px, face),
		font_size, css_px))
	button.add_theme_font_size_override("font_size", font_size)
	button.set_css_font(css_px, spacing_em, false, face)
	button.css_line_height = line_height_px
