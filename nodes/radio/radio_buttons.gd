class_name RadioButtons
## The Radio player's button looks (web RadioPlayer iconBtn / airBtn / unlockBtn): `appearance: none` — one box for every
## state and one text colour, plus the feedback theme.css gives every button of `.radio-player-root`: the mouse over it
## brightens the label and rings it in accent blue, a press shrinks it to 0.92. Labels are CssButton runs in the UI font
## with the system faces Chrome takes its symbols from.

const STATES := ["normal", "hover", "pressed", "hover_pressed", "focus", "disabled"]
const TEXT_COLORS := ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color",
	"font_focus_color", "font_disabled_color"]
const HOVER_STATES := ["hover", "hover_pressed"]
const HOVER_COLORS := ["font_hover_color", "font_hover_pressed_color"]
const BORDER_PX := 1
const HOVER_BRIGHTNESS := 1.75                  # web .radio-player-root button:hover — filter: brightness(1.75)
const HOVER_RING := Color(120.0 / 255.0, 180.0 / 255.0, 1.0, 0.55)   # ... box-shadow 0 0 0 1px rgba(120,180,255,.55)
const PRESS_SCALE := 0.92                       # web .radio-player-root button:active — transform: scale(0.92)
const HALF := 0.5

## Every state drawn by `box`, every text in `color`, and the hover feedback over both (a caller with its own hover look
## overrides the states again afterwards).
static func dress(button: Button, box: StyleBox, color: Color) -> void:
	for state in STATES:
		button.add_theme_stylebox_override(state, box)
	for key in TEXT_COLORS:
		button.add_theme_color_override(key, color)
	for key in HOVER_COLORS:
		button.add_theme_color_override(key, brighten(color))
	var ringed := _ringed(box)
	if ringed != null:
		for state in HOVER_STATES:
			button.add_theme_stylebox_override(state, ringed)

## The label lit the way Chrome's `filter: brightness()` lights it (the alpha stays).
static func brighten(color: Color) -> Color:
	return Color(minf(color.r * HOVER_BRIGHTNESS, 1.0), minf(color.g * HOVER_BRIGHTNESS, 1.0),
		minf(color.b * HOVER_BRIGHTNESS, 1.0), color.a)

## A press shrinks the button about its middle and lets go on release (web :active on the player's buttons).
static func press_scale(button: Button) -> void:
	var centre := func() -> void: button.pivot_offset = button.size * HALF
	button.resized.connect(centre)
	centre.call()
	button.button_down.connect(func() -> void: button.scale = Vector2.ONE * PRESS_SCALE)
	button.button_up.connect(func() -> void: button.scale = Vector2.ONE)
	button.mouse_exited.connect(func() -> void: button.scale = Vector2.ONE)

## The box with the hover ring around it; null when the box draws no border of its own (a glass bar: only its label lits).
static func _ringed(box: StyleBox) -> StyleBox:
	var flat := box as StyleBoxFlat
	if flat == null:
		return null
	var ring := flat.duplicate() as StyleBoxFlat
	ring.border_color = HOVER_RING
	return ring

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
