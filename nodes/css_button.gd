class_name CssButton extends Button
## A Button whose label is drawn the way Chrome draws it: a CssTextRun at the fractional letter spacing and size, placed
## by the button's alignment in the current state's content box (a pressed box's shifted margins move it) and coloured
## by that state's theme colour. The native text stays empty — its width would carry the whole-pixel spacing — while
## `text` reads and writes the label; the box is at least the run plus the content margins, and at least what
## custom_minimum_size asks. The font override still sizes the line box.

const HALF := 0.5
const STYLES := {
	DRAW_NORMAL: "normal", DRAW_PRESSED: "pressed", DRAW_HOVER: "hover", DRAW_DISABLED: "disabled",
	DRAW_HOVER_PRESSED: "hover_pressed",
}
const COLORS := {
	DRAW_NORMAL: "font_color", DRAW_PRESSED: "font_pressed_color", DRAW_HOVER: "font_hover_color",
	DRAW_DISABLED: "font_disabled_color", DRAW_HOVER_PRESSED: "font_hover_pressed_color",
}
const FOCUS_COLOR := "font_focus_color"

## What the box lost to whole pixels across (set by the layout): Chrome snaps the border, the text keeps the CSS place.
var css_offset_x := 0.0:
	set(value):
		css_offset_x = value
		queue_redraw()

var _label := ""
var _run := CssTextRun.new()
var _css_px := 0.0                              # 0: no CSS font yet
var _spacing_em := 0.0
var _bold := false
var _face: Font = null
var _own_minimum := Vector2.ZERO                # what the caller asked of custom_minimum_size

## The label's CSS font: `font_px` spaced `letter_spacing_em`, synthetic bold, drawn by `font_face` (the UI font).
func set_css_font(font_px: float, letter_spacing_em := 0.0, synthetic_bold := false, font_face: Font = null) -> void:
	_css_px = font_px
	_spacing_em = letter_spacing_em
	_bold = synthetic_bold
	_face = font_face
	_relayout()

## The label — what `text =` sets from outside (a script's own assignment skips `_set`: subclasses call this).
func set_label(value: String) -> void:
	_label = value
	set_text("")
	_relayout()

## The minimum size the box keeps under the run — what `custom_minimum_size =` sets from outside.
func keep_minimum_size(value: Vector2) -> void:
	_own_minimum = value
	_relayout()

func run() -> CssTextRun:
	return _run

## The run's top-left corner: across by the alignment, down on the font's line centred like the native text.
func text_origin() -> Vector2:
	var style := get_theme_stylebox(STYLES[get_draw_mode()])
	var line := get_theme_font("font").get_height(get_theme_font_size("font_size"))
	var inner := size - style.get_minimum_size()
	var top := style.get_margin(SIDE_TOP) + floorf((inner.y - line) * HALF)
	return _run.placed(Rect2(style.get_margin(SIDE_LEFT) + css_offset_x, top, inner.x, line), alignment)

func text_color() -> Color:
	var mode := get_draw_mode()
	return get_theme_color(FOCUS_COLOR if mode == DRAW_NORMAL and has_focus() else COLORS[mode])

func _draw() -> void:
	_run.draw(self, text_origin(), text_color())

func _set(property: StringName, value: Variant) -> bool:
	match property:
		&"text":
			set_label(value)
		&"custom_minimum_size":
			keep_minimum_size(value)
		_:
			return false
	return true

func _get(property: StringName) -> Variant:
	match property:
		&"text":
			return _label
		&"custom_minimum_size":
			return _own_minimum
	return null

## A variant's new boxes change the margins around the run.
func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED:
		_relayout()

func _relayout() -> void:
	if _css_px <= 0.0:
		set_custom_minimum_size(_own_minimum)
		return
	_run = CssTextRun.new(_label, _css_px, _spacing_em, _bold, _face)
	var line := get_theme_font("font").get_height(get_theme_font_size("font_size"))   # empty native text holds none
	var box := Vector2(_run.width(), line) + get_theme_stylebox("normal").get_minimum_size()
	set_custom_minimum_size(_own_minimum.max(box))
	queue_redraw()
