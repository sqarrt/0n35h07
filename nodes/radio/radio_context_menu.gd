class_name RadioContextMenu extends Control
## The Radio library's context menu — web RadioExplorer.css `.rexp-ctx` / `.rexp-mi`: liquid glass (a 78% #0e131b fill
## over a 22 px backdrop blur, a 14% top highlight, 12 px corners, 0 14px 44px black 60% and a 22 px accent-12% glow),
## at least 208 px wide around 6 px of padding, its left at the click but no closer than 220 px to the right edge. A row
## per RadioExplorerMenu item: 8px 12px of padding on 8 px corners, the glyph centred in 15 px in accent-dim, 11 px later
## the label (12.5 px spaced 0.04em), the shortcut pushed right in muted 10 px 14 px after it — each centred on the
## row's tallest line. Hover lights a row accent 16% with #eaf5ff text; danger rows are #f88, disabled rows muted with
## the glyph at half opacity and no hover. A press anywhere outside closes it; a click on an enabled row chooses it.

signal chosen(action: String)
signal closed

const MIN_WIDTH := 208.0                        # border-box
const RIGHT_ROOM := 220.0                       # web left: min(x, innerWidth - 220)
const PADDING := 6.0
const BORDER_PX := GlassCard.BORDER_PX
const RADIUS := 12.0
const FILL := Color(14.0 / 255.0, 19.0 / 255.0, 27.0 / 255.0, 0.78)
const HIGHLIGHT := Color(1.0, 1.0, 1.0, 0.14)
const BACKDROP_SIGMA := 22.0
const SHADOW := Color(0.0, 0.0, 0.0, 0.6)
const SHADOW_OFFSET := Vector2(0.0, 14.0)
const SHADOW_BLUR := 44.0
const GLOW_ALPHA := 0.12
const GLOW_BLUR := 22.0
const ROW_PADDING := Vector2(12.0, 8.0)
const ROW_RADIUS := 8
const KEY_WIDTH := 15.0
const GAP := 11.0
const LABEL_PX := 12.5
const SPACING_EM := 0.04
const ACCEL_PX := 10.0
const ACCEL_SPACING_EM := LABEL_PX * SPACING_EM / ACCEL_PX   # the row's 0.5 px spacing, inherited as a length
const ACCEL_GAP := 14.0
const HOVER_FILL_ALPHA := 0.16
const HOVER_TEXT := Color("#eaf5ff")
const DANGER_TEXT := Color("#ff8888")
const DISABLED_KEY_ALPHA := 0.5
const HALF := 0.5

var _glow: ColorRect
var _glass: GlassCard
var _rows: Array[Panel] = []
var _items: Array[Dictionary] = []

func _init() -> void:
	name = "RadioContextMenu"
	mouse_filter = Control.MOUSE_FILTER_STOP
	_glow = CssBoxShadow.make(Color(UiTokens.ACCENT, GLOW_ALPHA), GLOW_BLUR, Vector2.ZERO, 0.0, RADIUS)
	add_child(_glow)
	_glass = GlassCard.new()
	add_child(_glass)
	_glass.set_look(FILL, HIGHLIGHT, RADIUS, BACKDROP_SIGMA)
	_glass.set_shadow(SHADOW_OFFSET, SHADOW_BLUR, 0.0, SHADOW)

## Show `items` with the click at `at` (the parent's coordinates) in a parent `screen_width` px wide.
func open(items: Array[Dictionary], at: Vector2, screen_width: float) -> void:
	_items = items
	for item in items:
		var row := _row(item)
		add_child(row)
		_rows.append(row)
	_layout()
	position = Vector2(minf(at.x, screen_width - RIGHT_ROOM), at.y)

func rows() -> Array[Panel]:
	return _rows

func items() -> Array[Dictionary]:
	return _items

## The row of `action`, or null.
func row_of(action: String) -> Panel:
	for i in _items.size():
		if _items[i][RadioExplorerMenu.ACTION] == action:
			return _rows[i]
	return null

## A click on a row: an enabled one is chosen and the menu goes.
func choose(index: int) -> void:
	if _items[index][RadioExplorerMenu.DISABLED]:
		return
	chosen.emit(_items[index][RadioExplorerMenu.ACTION])
	close()

func close() -> void:
	if is_queued_for_deletion():
		return
	closed.emit()
	queue_free()

## web: a pointerdown outside closes the menu and still reaches what it lands on.
func _input(event: InputEvent) -> void:
	var press := event as InputEventMouseButton
	if press != null and press.pressed and not get_global_rect().has_point(press.global_position):
		close()

func _row(item: Dictionary) -> Panel:
	var row := Panel.new()
	row.name = "Item"
	row.mouse_filter = Control.MOUSE_FILTER_STOP
	var families: Array = item[RadioExplorerMenu.FAMILIES]
	var key := CssLabel.new().styled(item[RadioExplorerMenu.GLYPH], LABEL_PX, SPACING_EM, _key_color(item), false,
		UiFont.base_with(families))
	key.name = "Key"
	row.add_child(key)
	var label := CssLabel.new().styled(I18n.t(item[RadioExplorerMenu.LABEL_KEY]), LABEL_PX, SPACING_EM, _text_color(item))
	label.name = "Label"
	row.add_child(label)
	var accel := CssLabel.new().styled(item[RadioExplorerMenu.ACCEL], ACCEL_PX, ACCEL_SPACING_EM, UiTokens.MUTED)
	accel.name = "Accel"
	accel.visible = not String(item[RadioExplorerMenu.ACCEL]).is_empty()
	row.add_child(accel)
	var index := _rows.size()
	row.mouse_entered.connect(func() -> void: _hover(index, true))
	row.mouse_exited.connect(func() -> void: _hover(index, false))
	row.gui_input.connect(func(event: InputEvent) -> void:
		var click := event as InputEventMouseButton
		if click != null and click.button_index == MOUSE_BUTTON_LEFT and not click.pressed:
			choose(index))
	_hover_style(row, false)
	return row

func _hover(index: int, on: bool) -> void:
	var item := _items[index]
	if item[RadioExplorerMenu.DISABLED]:
		return
	_hover_style(_rows[index], on)
	var label := _rows[index].get_node("Label") as CssLabel
	label.add_theme_color_override("font_color", HOVER_TEXT if on and not item[RadioExplorerMenu.DANGER] else _text_color(item))

func _hover_style(row: Panel, on: bool) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = Color(UiTokens.ACCENT, HOVER_FILL_ALPHA if on else 0.0)
	box.set_corner_radius_all(ROW_RADIUS)
	row.add_theme_stylebox_override("panel", box)

func _text_color(item: Dictionary) -> Color:
	if item[RadioExplorerMenu.DANGER]:
		return DANGER_TEXT
	return UiTokens.MUTED if item[RadioExplorerMenu.DISABLED] else UiTokens.TEXT

func _key_color(item: Dictionary) -> Color:
	if item[RadioExplorerMenu.DANGER]:
		return DANGER_TEXT
	return Color(UiTokens.ACCENT_DIM, DISABLED_KEY_ALPHA) if item[RadioExplorerMenu.DISABLED] else UiTokens.ACCENT_DIM

## The UI font's `line-height: normal` box at `css_px`: [ascent, height].
static func _css_line(css_px: float) -> Vector2:
	var ascent := roundi(UiFont.ASCENT_EM * css_px)
	return Vector2(ascent, ascent + roundi(UiFont.DESCENT_EM * css_px))

func _layout() -> void:
	var inset := BORDER_PX + PADDING
	var natural := 0.0
	for i in _rows.size():
		var row := _rows[i]
		var accel := row.get_node("Accel") as CssLabel
		natural = maxf(natural, 2.0 * ROW_PADDING.x + KEY_WIDTH + GAP + (row.get_node("Label") as CssLabel).css_size().x
			+ (ACCEL_GAP + accel.css_size().x if accel.visible else 0.0))
	var width := maxf(MIN_WIDTH, natural + 2.0 * inset)
	var row_width := width - 2.0 * inset
	var y := inset
	for i in _rows.size():
		var row := _rows[i]
		var families: Array = _items[i][RadioExplorerMenu.FAMILIES]
		var key := row.get_node("Key") as CssLabel
		var label := row.get_node("Label") as CssLabel
		var accel := row.get_node("Accel") as CssLabel
		var key_line := Vector2(UiFont.fallback_ascent_px(LABEL_PX, families), UiFont.fallback_line_px(LABEL_PX, families))
		var label_line := _css_line(LABEL_PX)
		var accel_line := _css_line(ACCEL_PX)
		var content := maxf(key_line.y, label_line.y)
		if accel.visible:
			content = maxf(content, accel_line.y)
		row.position = Vector2(inset, y)
		row.size = Vector2(row_width, 2.0 * ROW_PADDING.y + content)
		# align-items: center — each flex item's line box centred, its text on that box's baseline
		_place(key, ROW_PADDING.x + (KEY_WIDTH - key.css_size().x) * HALF, content, key_line)
		_place(label, ROW_PADDING.x + KEY_WIDTH + GAP, content, label_line)
		_place(accel, row_width - ROW_PADDING.x - accel.css_size().x, content, accel_line)
		y += row.size.y
	size = Vector2(width, y + inset)
	_glass.set_box(size)
	CssBoxShadow.place(_glow, Vector2.ZERO, size)

func _place(text: CssLabel, x: float, content: float, line: Vector2) -> void:
	var baseline := ROW_PADDING.y + (content - line.y) * HALF + line.x
	text.size = text.css_size()
	text.position = Vector2(x, baseline - text.run().baseline())
