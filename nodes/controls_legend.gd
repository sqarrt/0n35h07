class_name ControlsLegend extends Control
## The controls grid — port of web components/ControlsLegend: per binding its key chips (bordered, monospace 0.72rem) and
## the action, the items wrapping into centred rows (gaps 0.5rem / 1.2rem) within the width they are given. Letter keys
## stay as they are; the mouse buttons and the actions come from the dictionary. Widths follow Chrome's fractional
## advances; `layout(width)` places everything and returns the grid's size.

const MONOSPACE_FAMILIES := ["Consolas"]       # Chrome's `monospace` on Windows (CDP getPlatformFontsForNode)
const CSS_PX := 11.52                          # 0.72rem
const ACTION_SPACING_EM := 0.05
const ACTION_COLOR := Color("#888899")         # #889
const CHIP_TEXT := Color("#bbddff")            # #bdf
const CHIP_FILL := Color(68.0 / 255.0, 170.0 / 255.0, 1.0, 0.08)
const CHIP_BORDER := Color("#44aaff")
const CHIP_BORDER_PX := 1
const CHIP_RADIUS := 4
const CHIP_MIN := 22.0                         # min-width / height 22px
const CHIP_PADDING_X := 6.0
const CHIP_GAP := 3.0                          # the chips' flex gap
const ITEM_GAP := 7.2                          # key chips → action: 0.45rem
const ROW_GAP := 8.0                           # 0.5rem
const COLUMN_GAP := 19.2                       # 1.2rem
const KEY_PREFIX := "@"                        # a dictionary key rather than a letter name
## [keys, action key] in web order.
const BINDINGS := [[["W", "A", "S", "D"], "ctrlMove"], [["Space"], "ctrlJump"], [["Shift"], "ctrlDash"],
	[["@keyLmb"], "ctrlFire"], [["@keyRmb"], "ctrlShield"], [["@keyMouse"], "ctrlLook"], [["V"], "ctrlView"],
	[["Esc"], "ctrlPause"]]
const HALF := 0.5

## One binding's chips and action with their CSS widths.
class Item:
	var chips: Array[Panel] = []
	var chip_widths: Array[float] = []
	var action: CssLabel
	var action_width := 0.0

	func width() -> float:
		var keys := 0.0
		for w in chip_widths:
			keys += w
		return keys + ControlsLegend.CHIP_GAP * (chip_widths.size() - 1) + ControlsLegend.ITEM_GAP + action_width

var _items: Array[Item] = []
var _face: SystemFont

func _init() -> void:
	name = "ControlsLegend"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_face = SystemFont.new()
	_face.font_names = PackedStringArray(MONOSPACE_FAMILIES)
	for binding in BINDINGS:
		var item := Item.new()
		for key in binding[0]:
			var text := I18n.t(String(key).trim_prefix(KEY_PREFIX)) if String(key).begins_with(KEY_PREFIX) else String(key)
			item.chips.append(_chip(text))
			item.chip_widths.append(maxf(CHIP_MIN, _css_width(text, 0.0) + 2.0 * (CHIP_PADDING_X + CHIP_BORDER_PX)))
		var action_text := I18n.t(binding[1])
		item.action = _label(action_text, ACTION_SPACING_EM, ACTION_COLOR)
		add_child(item.action)
		item.action_width = _css_width(action_text, ACTION_SPACING_EM)
		_items.append(item)

## Wrap the items into rows no wider than `width`, each centred; returns the grid's size.
func layout(width: float) -> Vector2:
	var rows: Array[Array] = [[]]
	var row_width := 0.0
	for item in _items:
		var starts_row: bool = (rows.back() as Array).is_empty()
		var added: float = item.width() if starts_row else row_width + COLUMN_GAP + item.width()
		if not starts_row and added > width:
			rows.append([])
			added = item.width()
		rows.back().append(item)
		row_width = added
	var y := 0.0
	for row in rows:
		var total: float = COLUMN_GAP * (row.size() - 1)
		for item in row:
			total += (item as Item).width()
		var x: float = (width - total) * HALF
		for item in row:
			_place_item(item, x, y)
			x += (item as Item).width() + COLUMN_GAP
		y += CHIP_MIN + ROW_GAP
	return Vector2(width, y - ROW_GAP)

func _place_item(item: Item, left: float, top: float) -> void:
	var x := left
	for i in item.chips.size():
		var chip := item.chips[i]
		chip.position = Vector2(CssPixel.snap(x), CssPixel.snap(top))
		chip.size = Vector2(CssPixel.snap(x + item.chip_widths[i]) - chip.position.x, CHIP_MIN)
		var text := chip.get_child(0) as CssLabel
		var text_box := text.get_combined_minimum_size()
		var text_left := x - chip.position.x + (item.chip_widths[i] - text_box.x) * HALF   # centred in the CSS chip
		text.position = Vector2(CssPixel.snap(text_left), roundf((chip.size.y - text_box.y) * HALF))
		text.css_offset_x = text_left - text.position.x
		text.size = text_box
		x += item.chip_widths[i] + CHIP_GAP
	var action_box := item.action.get_combined_minimum_size()
	x += ITEM_GAP - CHIP_GAP
	item.action.position = Vector2(CssPixel.snap(x), CssPixel.snap(top + (CHIP_MIN - action_box.y) * HALF))
	item.action.css_offset_x = x - item.action.position.x
	item.action.size = action_box

func _chip(text: String) -> Panel:
	var chip := Panel.new()
	chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var box := StyleBoxFlat.new()
	box.bg_color = CHIP_FILL
	box.border_color = CHIP_BORDER
	box.set_border_width_all(CHIP_BORDER_PX)
	box.set_corner_radius_all(CHIP_RADIUS)
	chip.add_theme_stylebox_override("panel", box)
	chip.add_child(_label(text, 0.0, CHIP_TEXT))
	add_child(chip)
	return chip

func _label(text: String, spacing_em: float, color: Color) -> CssLabel:
	return CssLabel.new().styled(text, CSS_PX, spacing_em, color, false, _face)

## A run's CSS width at 0.72rem in the monospace face.
func _css_width(text: String, spacing_em: float) -> float:
	return UiFont.css_width(text, CSS_PX, spacing_em, _face)
