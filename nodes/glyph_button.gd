class_name GlyphButton
extends BaseButton
## A symbol glyph on a transparent button with `line-height: 1` (web theme.css .lobby-picker-x, .lobby-seat-cancel): the
## box is the font size plus the padding and the glyph's advance wide, however tall the system face that draws the glyph
## (Chrome takes ✕ from Segoe UI Symbol); the glyph sits on the UI font's baseline, muted until hovered.

const SYMBOL_FAMILIES := ["Segoe UI Symbol"]
const HALF := 0.5

var glyph := ""
var css_px := 0.0
var padding := Vector2.ZERO

var _font: Font
var _hovered := false

func _init(glyph_text := "", font_px := 0.0, box_padding := Vector2.ZERO) -> void:
	glyph = glyph_text
	css_px = font_px
	padding = box_padding
	focus_mode = Control.FOCUS_NONE
	_font = UiFont.base_with(SYMBOL_FAMILIES)
	custom_minimum_size = Vector2(glyph_advance() + padding.x * 2.0, css_px + padding.y * 2.0)

func glyph_advance() -> float:
	return _font.get_string_size(glyph, HORIZONTAL_ALIGNMENT_LEFT, -1, UiFont.css_size(css_px)).x

func glyph_color() -> Color:
	return UiTokens.TEXT if _hovered else UiTokens.MUTED

func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_ENTER or what == NOTIFICATION_MOUSE_EXIT:
		_hovered = what == NOTIFICATION_MOUSE_ENTER
		queue_redraw()

## Chrome's line-height 1: the UI font's rounded ascent and descent centred in a line box the font size tall.
func _draw() -> void:
	var ascent := roundi(UiFont.ASCENT_EM * css_px)
	var descent := roundi(UiFont.DESCENT_EM * css_px)
	var baseline := padding.y + (css_px - ascent - descent) * HALF + ascent
	draw_string(_font, Vector2(padding.x, baseline), glyph, HORIZONTAL_ALIGNMENT_LEFT, -1, UiFont.css_size(css_px),
		glyph_color())
