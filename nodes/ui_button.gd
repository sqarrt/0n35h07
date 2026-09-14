class_name UiButton extends CssButton
## The project's hard button — port of web ui/Button + theme.css `.btn`: the 16 px UI font spaced 0.18em, 12 / 32 px
## padding inside a 1 px border, at least 220 px wide, a flat fill switching instantly per state. Variants: primary
## (filled, bold), secondary (outline) and ghost (dim outline). Clicks and hovers sound like the web button.

const PRIMARY := "primary"
const SECONDARY := "secondary"
const GHOST := "ghost"
const GO := "go"                         # primary + .btn--go: the lobby READY
const GO_FILL := Color("#23b582")
const GO_HOVER := Color("#2bcf96")
const STOP := "stop"                     # primary + .btn--stop: the lobby STOP while searching
const STOP_FILL := Color("#d83a44")
const STOP_HOVER := Color("#e44a54")
const FONT_SIZE := 16                    # 1rem
const LETTER_SPACING_EM := 0.18
const PADDING_X := 32.0                  # 2rem
const PADDING_Y := 12.0                  # 0.75rem
const BORDER_PX := 1
const MIN_WIDTH := 220.0
const BUTTON_HEIGHT := 44.0              # 16 px line (18) + 12 px padding and 1 px border, twice
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
	# .btn--go over .btn--primary; `.btn--primary:disabled` outranks it, so a disabled READY keeps the primary fill
	GO: {
		"normal": [GO_FILL, GO_FILL, UiTokens.INK],
		"hover": [GO_HOVER, GO_HOVER, UiTokens.INK],
		"pressed": [GO_HOVER, GO_HOVER, UiTokens.INK],
		"disabled": [UiTokens.ACCENT_FILL, UiTokens.ACCENT_FILL, UiTokens.INK],
	},
	# .btn--stop over .btn--primary: red with white text, brighter under the mouse
	STOP: {
		"normal": [STOP_FILL, STOP_FILL, Color.WHITE],
		"hover": [STOP_HOVER, STOP_HOVER, Color.WHITE],
		"pressed": [STOP_HOVER, STOP_HOVER, Color.WHITE],
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

## A button's CSS metrics — the `.btn` rule by default; inline styles override them (the settings language tile).
class Metrics:
	var font_px := float(UiButton.FONT_SIZE)
	var spacing_em := UiFont.control_spacing_em(UiButton.LETTER_SPACING_EM)
	var padding := Vector2(UiButton.PADDING_X, UiButton.PADDING_Y)
	var min_width := UiButton.MIN_WIDTH
	var always_bold := false
	var face: Font = null                  # null: UiFont.base()
	var line_adjust := 0                   # px added to the line box's bottom (a fallback face's metrics differ)
	var radius := 0                        # border-radius; a rounded box is anti-aliased like Chrome's curve
	var press_shift := 0                   # :active translateY: the pressed box and its label move down
	var looks := {}                        # an own [background, border, text] per state (empty: the variant's)

var variant := SECONDARY
var disabled_opacity := DISABLED_OPACITY
var metrics: Metrics
var fade: CssOpacity                     # set by grouped(): the disabled fade composites the button first

var _opacity := 1.0

func _init(label := "", button_variant := SECONDARY, sounds := true, button_metrics: Metrics = null) -> void:
	metrics = button_metrics if button_metrics != null else Metrics.new()
	set_label(label)
	keep_minimum_size(Vector2(metrics.min_width, 0.0))
	set_variant(button_variant)
	if sounds:
		UiSounds.attach(self)

func set_variant(value: String) -> void:
	variant = value
	var bold := metrics.always_bold or value in [PRIMARY, GO, STOP]
	var font_size := UiFont.css_size(metrics.font_px)
	var face := UiFont.bold_spaced(metrics.spacing_em, font_size, metrics.font_px, metrics.face) if bold \
		else UiFont.spaced(metrics.spacing_em, font_size, metrics.font_px, metrics.face)
	var font := UiFont.with_css_line(face, font_size, metrics.font_px)
	font.spacing_bottom += metrics.line_adjust
	for fallback in font.fallbacks:   # the fallback glyphs size the line when they are the taller face
		(fallback as FontVariation).spacing_bottom += metrics.line_adjust
	add_theme_font_override("font", font)
	add_theme_font_size_override("font_size", font_size)
	var looks: Dictionary = metrics.looks if not metrics.looks.is_empty() else LOOKS[value]
	for state in STATES:
		var look: Array = looks[state] if looks.has(state) else looks[STATES[state][0]]
		add_theme_stylebox_override(state, _box(look[BACKGROUND], look[BORDER], STATES[state][0] == "pressed"))
		add_theme_color_override(STATES[state][1], look[TEXT])
	add_theme_color_override("font_focus_color", looks["normal"][TEXT])
	add_theme_stylebox_override("focus", _focus_box())
	set_css_font(metrics.font_px, metrics.spacing_em, bold, metrics.face)

## Enable or disable, fading the whole button like CSS opacity (as one layer once grouped()).
func set_enabled(enabled: bool) -> void:
	disabled = not enabled
	_opacity = 1.0 if enabled else disabled_opacity
	if fade != null:
		fade.set_opacity(_opacity)
	else:
		modulate.a = _opacity

func opacity() -> float:
	return _opacity

## Wrap the button so its fade composites it as one layer — needed where a label sits over a fill (primary); lay out
## the returned box instead of the button.
func grouped() -> CssOpacity:
	fade = CssOpacity.new(self)
	fade.name = "%sGroup" % name
	modulate.a = 1.0
	fade.set_opacity(_opacity)
	return fade

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

func _box(background: Color, border: Color, pressed := false) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = background
	box.border_color = border
	box.set_border_width_all(BORDER_PX)
	box.set_corner_radius_all(metrics.radius)
	box.anti_aliasing = metrics.radius > 0   # square CSS box edges stay crisp
	box.content_margin_left = metrics.padding.x + BORDER_PX
	box.content_margin_right = metrics.padding.x + BORDER_PX
	box.content_margin_top = metrics.padding.y + BORDER_PX
	box.content_margin_bottom = metrics.padding.y + BORDER_PX
	if pressed and metrics.press_shift != 0:   # the whole box moves, its minimum size does not
		box.expand_margin_top = -metrics.press_shift
		box.expand_margin_bottom = metrics.press_shift
		box.content_margin_top += metrics.press_shift
		box.content_margin_bottom -= metrics.press_shift
	return box

func _focus_box() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.draw_center = false
	box.border_color = UiTokens.ACCENT
	box.set_border_width_all(FOCUS_OUTLINE_PX)
	box.set_expand_margin_all(FOCUS_OUTLINE_PX + FOCUS_OFFSET_PX)
	box.anti_aliasing = false
	return box
