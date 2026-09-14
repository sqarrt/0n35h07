class_name UiButton extends Button
## The project's hard button — port of web ui/Button + theme.css `.btn`: the 16 px UI font spaced 0.18em, 12 / 32 px
## padding inside a 1 px border, at least 220 px wide, a flat fill switching instantly per state. Variants: primary
## (filled, bold), secondary (outline) and ghost (dim outline). Clicks and hovers sound like the web button.

const PRIMARY := "primary"
const SECONDARY := "secondary"
const GHOST := "ghost"
const FONT_SIZE := 16                    # 1rem
const LETTER_SPACING_EM := 0.18
const PADDING_X := 32.0                  # 2rem
const PADDING_Y := 12.0                  # 0.75rem
const BORDER_PX := 1
const MIN_WIDTH := 220.0
const MARGIN_Y := 6.4                    # margin: 0.4rem 0 — a CssColumn margin
const DISABLED_OPACITY := 0.4
const FOCUS_OUTLINE_PX := 2              # :focus-visible outline 2px, offset 2px (Godot hides focus a click gave)
const FOCUS_OFFSET_PX := 2
const COOLDOWN_FILL := Color(120.0 / 255.0, 180.0 / 255.0, 1.0, 0.28)   # web PauseMenu cooldown span
const BACKGROUND := 0
const BORDER := 1
const TEXT := 2
## [background, border, text] per state. Where CSS hover and :active tie, the later rule wins: a primary or ghost
## button keeps its hover look while pressed, a secondary one darkens.
const LOOKS := {
	PRIMARY: {
		"normal": [UiTokens.ACCENT_FILL, UiTokens.ACCENT_FILL, UiTokens.INK],
		"hover": [UiTokens.ACCENT_BRIGHT, UiTokens.ACCENT_BRIGHT, UiTokens.INK],
		"pressed": [UiTokens.ACCENT_BRIGHT, UiTokens.ACCENT_BRIGHT, UiTokens.INK],
	},
	SECONDARY: {
		"normal": [Color.TRANSPARENT, UiTokens.LINE, UiTokens.ACCENT_DIM],
		"hover": [UiTokens.ACCENT_FILL, UiTokens.ACCENT_FILL, UiTokens.INK],
		"pressed": [UiTokens.ACCENT_PRESS, UiTokens.ACCENT_FILL, UiTokens.INK],
	},
	GHOST: {
		"normal": [Color.TRANSPARENT, UiTokens.GHOST_LINE, UiTokens.MUTED],
		"hover": [Color.TRANSPARENT, UiTokens.GHOST_LINE_HOVER, UiTokens.TEXT],
		"pressed": [Color.TRANSPARENT, UiTokens.GHOST_LINE_HOVER, UiTokens.TEXT],
	},
}
## Godot box state -> the CSS look it shows and the matching text colour key.
const STATES := {
	"normal": ["normal", "font_color"],
	"hover": ["hover", "font_hover_color"],
	"pressed": ["pressed", "font_pressed_color"],
	"hover_pressed": ["pressed", "font_hover_pressed_color"],
	"disabled": ["normal", "font_disabled_color"],
}

## A box with the pause RESUME cooldown fill over it (web: an absolutely placed span under the label, growing left to
## right inside the border). Drawn as the box, so the label stays on top.
class CooldownStyle extends StyleBox:
	var base: StyleBox
	var share := 0.0
	var fill_color := UiButton.COOLDOWN_FILL

	func _init(base_box: StyleBox = null) -> void:
		base = base_box
		if base_box == null:
			return
		for side in [SIDE_LEFT, SIDE_TOP, SIDE_RIGHT, SIDE_BOTTOM]:
			set_content_margin(side, base_box.get_content_margin(side))

	func fill_rect(rect: Rect2) -> Rect2:
		var inner := rect.grow(-UiButton.BORDER_PX)
		var right := CssPixel.snap(inner.position.x + inner.size.x * share)
		return Rect2(inner.position, Vector2(right - inner.position.x, inner.size.y))

	func _draw(to_canvas_item: RID, rect: Rect2) -> void:
		if base != null:
			base.draw(to_canvas_item, rect)
		RenderingServer.canvas_item_add_rect(to_canvas_item, fill_rect(rect), fill_color)

var variant := SECONDARY
var disabled_opacity := DISABLED_OPACITY

func _init(label := "", button_variant := SECONDARY, sounds := true) -> void:
	text = label
	custom_minimum_size.x = MIN_WIDTH
	set_variant(button_variant)
	if sounds:
		UiSounds.attach(self)

func set_variant(value: String) -> void:
	variant = value
	var bold := value == PRIMARY
	var face := UiFont.bold_spaced(LETTER_SPACING_EM, FONT_SIZE) if bold else UiFont.spaced(LETTER_SPACING_EM, FONT_SIZE)
	add_theme_font_override("font", UiFont.with_css_line(face, FONT_SIZE))
	add_theme_font_size_override("font_size", FONT_SIZE)
	var looks: Dictionary = LOOKS[value]
	for state in STATES:
		var look: Array = looks[STATES[state][0]]
		add_theme_stylebox_override(state, _box(look[BACKGROUND], look[BORDER], face.spacing_glyph))
		add_theme_color_override(STATES[state][1], look[TEXT])
	add_theme_color_override("font_focus_color", looks["normal"][TEXT])
	add_theme_stylebox_override("focus", _focus_box())

## Enable or disable, fading the whole button like CSS opacity.
func set_enabled(enabled: bool) -> void:
	disabled = not enabled
	modulate.a = 1.0 if enabled else disabled_opacity

## The RESUME cooldown fill (0..1) over the disabled box.
func set_cooldown_share(share: float) -> void:
	var style := get_theme_stylebox("disabled") as CooldownStyle
	if style == null:
		style = CooldownStyle.new(get_theme_stylebox("disabled"))
		add_theme_stylebox_override("disabled", style)
	if is_equal_approx(style.share, share):
		return
	style.share = share
	style.emit_changed()
	queue_redraw()

## `trailing_spacing`: Chrome keeps the letter spacing after the last glyph, so the label centres that much to the left.
func _box(background: Color, border: Color, trailing_spacing: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = background
	box.border_color = border
	box.set_border_width_all(BORDER_PX)
	box.anti_aliasing = false            # square CSS box edges
	box.content_margin_left = PADDING_X + BORDER_PX
	box.content_margin_right = PADDING_X + BORDER_PX + trailing_spacing
	box.content_margin_top = PADDING_Y + BORDER_PX
	box.content_margin_bottom = PADDING_Y + BORDER_PX
	return box

func _focus_box() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.draw_center = false
	box.border_color = UiTokens.ACCENT
	box.set_border_width_all(FOCUS_OUTLINE_PX)
	box.set_expand_margin_all(FOCUS_OUTLINE_PX + FOCUS_OFFSET_PX)
	box.anti_aliasing = false
	return box
