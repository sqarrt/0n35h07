class_name MenuText
## Text boxes the menu screens share — the web inline styles of screens/Settings, About, Lobby and SettingsControls:
## the h2 title (24 px bold, spaced 0.2em, accent), the field label (#556, 0.7rem spaced 0.15em) and the group
## sub-header (accent-dim 0.85rem spaced 0.18em, an 8 px padding over a 1 px surface-line rule). Share Tech Mono on
## Chrome's line boxes; fractional rem sizes take the nearest font size with the spacing and line box of the CSS size.

const TITLE_PX := 24.0                       # h2 (1.5em), bold
const TITLE_SPACING_EM := 0.2
const TITLE_MARGIN_BOTTOM := 16.0            # 1rem
const FIELD_PX := 11.2                       # 0.7rem
const FIELD_SPACING_EM := 0.15
const FIELD_COLOR := Color("#555566")        # #556
const SUB_HEADER_PX := 13.6                  # 0.85rem
const SUB_HEADER_SPACING_EM := 0.18
const SUB_HEADER_PADDING_BOTTOM := 8.0       # 0.5rem
const SUB_HEADER_BORDER_PX := 1
const SUB_HEADER_MARGIN_BOTTOM := 17.6       # 1.1rem
const SCREEN_TOP_SHARE := 0.06               # .panel-fill paddingTop: 6vh (Settings / About)

## A label in the UI font at a CSS pixel size, laid out and drawn at Chrome's fractional letter spacing.
static func label(node_name: String, text: String, css_px: float, spacing_em: float, color: Color,
		bold := false) -> CssLabel:
	var label := CssLabel.new()
	label.name = node_name
	label.text = text
	label.add_theme_stylebox_override("normal", StyleBoxEmpty.new())
	label.setup(css_px, spacing_em, bold)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

## The screen's h2.
static func title(node_name: String, text: String) -> Label:
	return label(node_name, text, TITLE_PX, TITLE_SPACING_EM, UiTokens.ACCENT, true)

## A control's caption (web `label` style).
static func field_label(node_name: String, text: String) -> Label:
	return label(node_name, text, FIELD_PX, FIELD_SPACING_EM, FIELD_COLOR)

## A group heading over its rule (web `subHeader`): lay it out at the full column width.
static func sub_header(node_name: String, text: String) -> Label:
	var header := label(node_name, text, SUB_HEADER_PX, SUB_HEADER_SPACING_EM, UiTokens.ACCENT_DIM)
	var rule := StyleBoxFlat.new()
	rule.draw_center = false
	rule.border_color = UiTokens.SURFACE_LINE
	rule.border_width_bottom = SUB_HEADER_BORDER_PX
	rule.anti_aliasing = false
	rule.content_margin_bottom = SUB_HEADER_PADDING_BOTTOM + SUB_HEADER_BORDER_PX
	header.add_theme_stylebox_override("normal", rule)
	return header
