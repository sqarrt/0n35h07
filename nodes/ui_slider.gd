class_name UiSlider extends Control
## Volume slider — port of web ui/Slider with theme.css `.slider`: the field label, 8 px below it an 18rem row with the
## range input (UiRange: a 6 px track, a 14×18 thumb) and the percentage right-aligned in a 4ch box 0.8rem after the
## track. 0..1 in whole percent steps (web range 0..100).

signal value_changed(value: float)

const LABEL_MARGIN_BOTTOM := 8.0          # 0.5rem
const ROW_WIDTH := 288.0                  # 18rem
const ROW_GAP := 12.8                     # 0.8rem
const VALUE_PX := 12.0                    # 0.75rem
const VALUE_CHARS := 4.0                  # width: 4ch
const ZERO_GLYPH := "0"                   # a CSS ch is the advance of "0"
const TRACK_HEIGHT := UiRange.TRACK_HEIGHT
const THUMB_SIZE := UiRange.THUMB_SIZE
const PERCENT_MAX := UiRange.PERCENT_MAX
const PERCENT_FORMAT := "%d%%"
const HALF := 0.5

var value := 0.0

var _label: Label
var _value_label: Label
var _range: UiRange

func _init(caption := "", initial := 0.0) -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	_label = MenuText.field_label("Label", caption)
	add_child(_label)
	_range = UiRange.new()
	_range.name = "Range"
	_range.value_changed.connect(func(fraction: float) -> void:
		_show(fraction)
		value_changed.emit(value))
	add_child(_range)
	_value_label = MenuText.label("Value", "", VALUE_PX, 0.0, UiTokens.ACCENT_DIM)
	_value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_value_label)
	set_value(initial)
	resized.connect(_layout)

func set_value(fraction: float) -> void:
	_range.set_value(fraction)
	_show(_range.value)

func label() -> Label:
	return _label

func value_label() -> Label:
	return _value_label

func range_input() -> UiRange:
	return _range

## The row under the label: the track, the gap and the 4ch percentage.
func row_top() -> float:
	return _label.get_combined_minimum_size().y + LABEL_MARGIN_BOTTOM

## 4ch at Chrome's fractional advance (Godot rounds a glyph's advance to a pixel: 7 px for 6.48), measured large.
func value_width() -> float:
	var font := _value_label.get_theme_font("font")
	var advance := font.get_string_size(ZERO_GLYPH, HORIZONTAL_ALIGNMENT_LEFT, -1, UiFont.MEASURE_PX).x
	return VALUE_CHARS * advance * VALUE_PX / UiFont.MEASURE_PX

func track_rect() -> Rect2:
	var row_height := _value_label.get_combined_minimum_size().y
	var width := ROW_WIDTH - ROW_GAP - value_width()
	return Rect2(0.0, row_top() + (row_height - TRACK_HEIGHT) * HALF, width, TRACK_HEIGHT)

func thumb_rect() -> Rect2:
	return Rect2(_range.thumb_rect().position + _range_box().position, THUMB_SIZE)

func _get_minimum_size() -> Vector2:
	return Vector2(ROW_WIDTH, row_top() + _value_label.get_combined_minimum_size().y)

func _show(fraction: float) -> void:
	value = fraction
	_value_label.text = PERCENT_FORMAT % roundi(value * PERCENT_MAX)

## The range input's box: the track widened to the thumb's height.
func _range_box() -> Rect2:
	var track := track_rect()
	return Rect2(track.position.x, track.position.y - (THUMB_SIZE.y - TRACK_HEIGHT) * HALF, track.size.x, THUMB_SIZE.y)

func _layout() -> void:
	_label.position = Vector2.ZERO
	_label.size = _label.get_combined_minimum_size()
	var box := _range_box()
	_range.position = box.position
	_range.size = box.size
	_value_label.position = Vector2(CssPixel.snap(track_rect().end.x + ROW_GAP), row_top())
	_value_label.size = Vector2(value_width(), _value_label.get_combined_minimum_size().y)
