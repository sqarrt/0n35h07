class_name RadioVolumeRow extends Control
## The expanded Radio player's volume row — web RadioPlayer volRow: the 🔊 pictogram (volLabel: #667 at 0.95rem spaced
## 0.14em, drawn by Chrome from Segoe UI Emoji) and, 8 px on, the range input filling the row. The row is as tall as the
## pictogram's mixed line box; the pictogram sits on that box's baseline, the range centred in the row.

signal volume_changed(value: float)

const GAP := 8.0
const ICON := "🔊"
const ICON_PX := 15.2                           # 0.95rem
const ICON_SPACING_EM := 0.14
const ICON_COLOR := Color("#666677")            # #667
const EMOJI_FAMILIES := ["Segoe UI Emoji"]
const HALF := 0.5

var _icon: CssLabel
var _range: UiRange

func _init() -> void:
	name = "Volume"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_icon = CssLabel.new().styled(ICON, ICON_PX, ICON_SPACING_EM, ICON_COLOR, false, UiFont.base_with(EMOJI_FAMILIES))
	_icon.name = "Icon"
	add_child(_icon)
	_range = UiRange.new()
	_range.name = "Range"
	_range.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_range.value_changed.connect(func(value: float) -> void: volume_changed.emit(value))
	add_child(_range)
	resized.connect(_layout)

func set_volume(value: float) -> void:
	_range.set_value(value)

func range_input() -> UiRange:
	return _range

func icon() -> CssLabel:
	return _icon

func row_height() -> float:
	return UiFont.fallback_line_px(ICON_PX, EMOJI_FAMILIES)

func _get_minimum_size() -> Vector2:
	return Vector2(0.0, row_height())

func _layout() -> void:
	var baseline := UiFont.fallback_ascent_px(ICON_PX, EMOJI_FAMILIES)
	var icon_box := _icon.css_size()
	_icon.size = icon_box
	_icon.position = Vector2(0.0, baseline - _icon.run().baseline())
	var left := CssPixel.snap(icon_box.x + GAP)
	_range.position = Vector2(left, CssPixel.snap((size.y - UiRange.THUMB_SIZE.y) * HALF))
	_range.size = Vector2(maxf(0.0, size.x - left), UiRange.THUMB_SIZE.y)
