class_name CssFieldText extends Control
## Chrome's text inside a native LineEdit — an `<input>` lays its value out with the fractional letter spacing Godot's
## LineEdit cannot (its spacing is whole pixels): the field keeps editing, scrolling and the mouse, while its own text,
## placeholder, caret and selection turn transparent and this overlay draws them as CSS runs — the value (or the
## placeholder when empty) aligned like the field, the caret blinking at its glyph's pen, the selection behind the
## glyphs it covers.

const CARET_WIDTH := 1.0
const BLINK_S := 0.53                            # Windows' caret blink time, which Chrome follows
const TRANSPARENT := Color(0.0, 0.0, 0.0, 0.0)
const HIDDEN_COLORS := ["font_color", "font_placeholder_color", "caret_color", "selection_color", "font_selected_color",
	"font_uneditable_color"]
const HALF := 0.5

var field: LineEdit
var css_px := 16.0
var spacing_em := 0.0
var face: Font = null
var text_color := Color.WHITE
var placeholder_color := Color.WHITE
var caret_color := Color.WHITE
var selection_color := Color(1.0, 1.0, 1.0, 0.2)

var _run: CssTextRun
var _run_text := ""
var _blink := 0.0
var _state := []

## Put the overlay on `line_edit`: its current text, placeholder, caret and selection colours move here.
static func attach(line_edit: LineEdit, font_px: float, letter_spacing_em: float, font_face: Font = null) -> CssFieldText:
	var overlay := CssFieldText.new()
	overlay.name = "CssText"
	overlay.field = line_edit
	overlay.css_px = font_px
	overlay.spacing_em = letter_spacing_em
	overlay.face = font_face
	overlay.text_color = line_edit.get_theme_color("font_color")
	overlay.placeholder_color = line_edit.get_theme_color("font_placeholder_color")
	overlay.caret_color = line_edit.get_theme_color("caret_color")
	overlay.selection_color = line_edit.get_theme_color("selection_color")
	for key in HIDDEN_COLORS:
		line_edit.add_theme_color_override(key, TRANSPARENT)
	line_edit.add_child(overlay)
	line_edit.text_changed.connect(func(_text: String) -> void: overlay.restart_blink())
	return overlay

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

## The run shown now: the value, or the placeholder while the field is empty.
func run() -> CssTextRun:
	var shown := field.text if field.text != "" else field.placeholder_text
	if _run == null or shown != _run_text:
		_run_text = shown
		_run = CssTextRun.new(shown, css_px, spacing_em, false, face)
	return _run

func showing_placeholder() -> bool:
	return field.text == "" and field.placeholder_text != ""

## Where the run's line box starts in the field: inside the style's content box, aligned like the field and scrolled.
func text_origin() -> Vector2:
	var style := field.get_theme_stylebox("focus" if field.has_focus() else "normal")
	var content := Rect2(Vector2(style.get_margin(SIDE_LEFT), style.get_margin(SIDE_TOP)), field.size - style.get_minimum_size())
	var shown := run()
	var origin := shown.placed(content, field.alignment if shown.width() <= content.size.x else HORIZONTAL_ALIGNMENT_LEFT,
		VERTICAL_ALIGNMENT_CENTER)
	origin.x -= field.get_scroll_offset()
	return origin

## The caret's x in the field: the pen of the glyph at the caret column.
func caret_x() -> float:
	var shown := run()
	var column := field.caret_column if not showing_placeholder() else 0
	return text_origin().x + _pen(shown, column)

func restart_blink() -> void:
	_blink = 0.0
	queue_redraw()

## Whether the field changed since the last look: LineEdit signals neither caret moves nor text set from code.
func sync() -> bool:
	var selection := Vector2i(field.get_selection_from_column(), field.get_selection_to_column()) \
		if field.has_selection() else Vector2i.ZERO
	var state := [field.text, field.placeholder_text, field.caret_column, field.get_scroll_offset(), field.has_focus(),
		selection, field.size, field.editable]
	if state == _state:
		return false
	_state = state
	return true

## While focused the caret blinks, so redraw each frame; otherwise only when the field changed.
func _process(delta: float) -> void:
	_blink += delta
	if field != null and (sync() or field.has_focus()):
		queue_redraw()

func _draw() -> void:
	if field == null:
		return
	var shown := run()
	var origin := text_origin()
	if field.has_selection() and not showing_placeholder():
		var from := origin.x + _pen(shown, field.get_selection_from_column())
		var to := origin.x + _pen(shown, field.get_selection_to_column())
		draw_rect(Rect2(from, origin.y, to - from, shown.line_height()), selection_color)
	shown.draw(self, origin, placeholder_color if showing_placeholder() else text_color)
	if field.has_focus() and field.editable and fmod(_blink, 2.0 * BLINK_S) < BLINK_S:
		draw_rect(Rect2(caret_x(), origin.y, CARET_WIDTH, shown.line_height()), caret_color)

static func _pen(shown: CssTextRun, column: int) -> float:
	var pens := shown.glyph_positions()
	if column <= 0 or pens.is_empty():
		return 0.0
	return pens[column] if column < pens.size() else shown.width()
