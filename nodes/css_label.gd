class_name CssLabel extends Label
## A Label drawn the way Chrome draws a CSS line of the UI font: a CssTextRun at the fractional letter spacing and size.
## The Label API stays — text, alignment, the theme's font_color, the stylebox — while the native glyphs are cut before
## shaping (no width, the line box's height), the run draws the text and its box is the run's width over the CSS line
## box. A wrapping, trimmed or multi-line label draws natively with the whole-pixel spaced face.

var css_px := 0.0                               # 0: not set up yet
var spacing_em := 0.0
var bold := false
var face: Font = null                           # null: UiFont.base()
## What the box lost to whole pixels across (set by the layout): Chrome snaps the box, the text keeps the CSS place.
var css_offset_x := 0.0:
	set(value):
		css_offset_x = value
		queue_redraw()

var _run: CssTextRun
var _own_minimum := Vector2.ZERO                # what the caller asked of custom_minimum_size

func _init() -> void:
	visible_characters_behavior = TextServer.VC_CHARS_BEFORE_SHAPING

## The CSS font: `font_px` spaced `letter_spacing_em`, synthetic bold, drawn by `font_face` (the UI font by default).
func setup(font_px: float, letter_spacing_em := 0.0, synthetic_bold := false, font_face: Font = null) -> void:
	css_px = font_px
	spacing_em = letter_spacing_em
	bold = synthetic_bold
	face = font_face
	var font_size := UiFont.css_size(font_px)
	var spaced := UiFont.bold_spaced(letter_spacing_em, font_size, font_px, font_face) if synthetic_bold \
		else UiFont.spaced(letter_spacing_em, font_size, font_px, font_face)
	add_theme_font_override("font", UiFont.with_face_line(spaced, font_size, font_face) if font_face is SystemFont
		else UiFont.with_css_line(spaced, font_size, font_px))
	add_theme_font_size_override("font_size", font_size)
	_relayout()

## A caption in one call: its text, CSS font and colour, no stylebox margins, clicks let through.
func styled(label_text: String, font_px: float, letter_spacing_em: float, color: Color, synthetic_bold := false,
		font_face: Font = null) -> CssLabel:
	text = label_text                          # the script's own assignment skips _set: setup() lays the run out
	add_theme_stylebox_override("normal", StyleBoxEmpty.new())
	add_theme_color_override("font_color", color)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	setup(font_px, letter_spacing_em, synthetic_bold, font_face)
	return self

## Whether the run draws the text (a single unwrapped, untrimmed line).
func draws_run() -> bool:
	return css_px > 0.0 and autowrap_mode == TextServer.AUTOWRAP_OFF \
		and text_overrun_behavior == TextServer.OVERRUN_NO_TRIMMING and not text.contains("\n")

func run() -> CssTextRun:
	return _run

## The run's top-left corner inside the label: the stylebox's content box, placed by the alignments.
func text_origin() -> Vector2:
	var style := get_theme_stylebox("normal")
	var content := Rect2(Vector2(style.get_margin(SIDE_LEFT) + css_offset_x, style.get_margin(SIDE_TOP)),
		size - style.get_minimum_size())
	return _run.placed(content, horizontal_alignment, vertical_alignment)

func _draw() -> void:
	if not draws_run():
		return
	var origin := text_origin()
	var shadow := get_theme_color("font_shadow_color")
	if shadow.a > 0.0:   # under the text, like the native Label's (the streak glitch copies' ±1 px chroma)
		var offset := Vector2(get_theme_constant("shadow_offset_x"), get_theme_constant("shadow_offset_y"))
		_run.draw(self, origin + offset, shadow)
	_run.draw(self, origin, get_theme_color("font_color"))

## A stylebox set after setup (a sub-header's rule) changes the box around the run.
func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED:
		_relayout()

## Text and trimming changes lay the run out again; the caller's minimum size is kept under the run's box.
func _set(property: StringName, value: Variant) -> bool:
	match property:
		&"text":
			set_text(value)
		&"autowrap_mode":
			set_autowrap_mode(value)
		&"text_overrun_behavior":
			set_text_overrun_behavior(value)
		&"custom_minimum_size":
			_own_minimum = value
		_:
			return false
	_relayout()
	return true

func _get(property: StringName) -> Variant:
	return _own_minimum if property == &"custom_minimum_size" else null

func _relayout() -> void:
	if css_px <= 0.0:
		return
	_run = CssTextRun.new(text, css_px, spacing_em, bold, face)
	if not draws_run():
		visible_characters = -1
		set_custom_minimum_size(_own_minimum)
		return
	visible_characters = 0
	var box := Vector2(_run.width(), _run.line_height()) + get_theme_stylebox("normal").get_minimum_size()
	set_custom_minimum_size(_own_minimum.max(box))
	queue_redraw()
