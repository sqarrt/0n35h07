class_name RadioExplorer extends RadioWindow
## The LIBRARY window of the Radio screen — web components/RadioExplorer: a RadioWindow 612×372 placed right of centre
## (x = half the screen − 306 + 170, y = 44% of it − 186), resized no smaller than 380×260, titled by the folder shown
## (the library's name at its root). Under the bar: the toolbar (back ◀, up ▲, home ⌂ — back and up at 40% when there is
## nowhere to go, home lit in the accent fill with a 12 px glow), the address bar (the folder's OS path, clicked to copy),
## the grid of folders then tracks (104 px cells 8 px apart, rows 18 px apart, inside 18 / 16 px of padding) and the
## status bar (the counts, and the visualizer's mode pill). A click selects (Ctrl toggles, Shift takes the range), a
## double click opens a folder or plays the folder's tracks from that one. Context menu, rename, drag and drop and the
## visualizer come with the next slice.

signal play_requested(queue: Array, start_index: int)

const WINDOW_SIZE := Vector2(612.0, 372.0)       # web W0 / H0
const MIN_SIZE := Vector2(380.0, 260.0)
const CENTRE_SHIFT := 170.0
const TOP_SHARE := 0.44
const TITLE_KEY := "radioLibrary"
const ITEMS_KEY := "radioItems"
const FOLDERS_KEY := "radioFolders"
const HOME_KEY := "radioHome"
const STATUS_FORMAT := "%d %s · %d %s"
const SELECTED_FORMAT := " · %d ✓"
const TOOLS_PADDING := 8.0
const TOOLS_GAP := 6.0
const TOOL_HEIGHT := 26.0
const TOOL_MIN_WIDTH := 30.0
const TOOL_PADDING_X := 9.0
const TOOL_RADIUS := 3
const TOOL_PX := 12.0
const TOOL_FILL_ALPHA := 0.05
const TOOL_HOVER_ALPHA := 0.14
const HOME_GLOW_BLUR := 12.0
const HOME_GLOW_ALPHA := 0.35
const DISABLED_OPACITY := 0.4
const BACK_FAMILIES := ["Segoe UI Symbol"]    # Chrome's faces for the glyphs Share Tech Mono lacks
const UP_FAMILIES := ["Arial"]
const HOME_FAMILIES := ["Arial"]
const BACK_GLYPH := "◀"
const UP_GLYPH := "▲"
const HOME_GLYPH := "⌂"
const ADDRESS_PADDING := Vector2(8.0, 6.0)
const FIELD_HEIGHT := 24.0
const FIELD_PADDING_X := 9.0
const FIELD_PX := 12.0
const FIELD_FILL := Color(5.0 / 255.0, 8.0 / 255.0, 13.0 / 255.0, 0.7)
const FIELD_RADIUS := 3
const GRID_PADDING := Vector2(16.0, 18.0)
const COLUMN_GAP := 8.0
const ROW_GAP := 18.0
const STATUS_HEIGHT := 26.0
const STATUS_PADDING_X := 12.0
const STATUS_PX := 11.0
const STATUS_FILL_ALPHA := 0.03
const VIZ_SIZE := Vector2(92.0, 18.0)
const VIZ_PX := 10.0
const VIZ_SPACING_PX := 1.5
const VIZ_RADIUS := 10
const VIZ_FAMILIES := ["Cambria Math"]         # Chrome's face for ⟳
const VIZ_MODES := ["auto", "scope", "bars", "radial", "field"]
const VIZ_ICONS := {"auto": "⟳", "scope": "◉", "bars": "▥", "radial": "◎", "field": "✦"}
const VIZ_LABEL := "%s %s"
const SETTINGS_PATH := "user://radio.cfg"      # web localStorage 'radio.viz'
const SETTINGS_SECTION := "radio"
const SETTINGS_VIZ := "viz"
const WINDOWS_SEPARATOR := "\\"
const LIBRARY_SEPARATOR := "/"

var library: RadioLibrary
var display_root := ""                          # the address bar's root (parity captures pin the web's)
var settings_path := SETTINGS_PATH

var _path := ""
var _history: PackedStringArray = []
var _entries: Array = []
var _items: Array[RadioLibraryItem] = []
var _selection := {}
var _anchor := ""
var _viz := VIZ_MODES[0]
var _tools: Control
var _back: CssButton
var _up: CssButton
var _home: CssButton
var _home_glow: ColorRect
var _address: Control
var _field: Panel
var _field_text: CssLabel
var _grid: Control
var _status: Panel
var _status_text: CssLabel
var _viz_button: CssButton

func _init() -> void:
	super()
	name = "RadioExplorer"
	_tools = _row("Tools")
	_home_glow = CssBoxShadow.make(Color(UiTokens.ACCENT, HOME_GLOW_ALPHA), HOME_GLOW_BLUR, Vector2.ZERO, 0.0, TOOL_RADIUS)
	_tools.add_child(_home_glow)
	_back = _tool("Back", BACK_GLYPH, BACK_FAMILIES, false)
	_up = _tool("Up", UP_GLYPH, UP_FAMILIES, false)
	_home = _tool("Home", HOME_GLYPH, HOME_FAMILIES, true)
	_back.pressed.connect(go_back)
	_up.pressed.connect(go_up)
	_home.pressed.connect(go_home)
	_address = _row("Address")
	_field = Panel.new()
	_field.name = "Field"
	_field.mouse_filter = Control.MOUSE_FILTER_STOP
	var field_box := RadioButtons.outline(UiTokens.SURFACE_LINE, FIELD_RADIUS, FIELD_FILL)
	_field.add_theme_stylebox_override("panel", field_box)
	_field.clip_contents = true
	_address.add_child(_field)
	_field_text = CssLabel.new().styled("", FIELD_PX, 0.0, UiTokens.TEXT)
	_field_text.name = "Path"
	_field.add_child(_field_text)
	_grid = Control.new()
	_grid.name = "Grid"
	_grid.clip_contents = true
	_grid.mouse_filter = Control.MOUSE_FILTER_PASS
	content().add_child(_grid)
	_status = Panel.new()
	_status.name = "Status"
	_status.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var status_box := StyleBoxFlat.new()
	status_box.bg_color = Color(UiTokens.ACCENT, STATUS_FILL_ALPHA)
	status_box.border_color = UiTokens.SURFACE_LINE
	status_box.border_width_top = int(RULE_PX)
	_status.add_theme_stylebox_override("panel", status_box)
	content().add_child(_status)
	_status_text = CssLabel.new().styled("", STATUS_PX, 0.0, UiTokens.MUTED)
	_status_text.name = "Counts"
	_status.add_child(_status_text)
	_viz_button = CssButton.new()
	_viz_button.name = "Viz"
	_viz_button.focus_mode = Control.FOCUS_NONE
	_viz_button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	RadioButtons.dress(_viz_button, RadioButtons.outline(UiTokens.GHOST_LINE, VIZ_RADIUS), UiTokens.ACCENT_DIM)
	RadioButtons.set_font(_viz_button, VIZ_PX, VIZ_SPACING_PX / VIZ_PX, VIZ_FAMILIES, VIZ_PX)
	_viz_button.alignment = HORIZONTAL_ALIGNMENT_CENTER
	_viz_button.pressed.connect(cycle_viz)
	_status.add_child(_viz_button)
	content().resized.connect(_layout_content)

## web useWindowChrome's first geometry for a screen of `screen` px.
static func initial_geometry(screen: Vector2) -> Rect2:
	return Rect2(roundf(screen.x * HALF - WINDOW_SIZE.x * HALF + CENTRE_SHIFT),
		roundf(screen.y * TOP_SHARE - WINDOW_SIZE.y * HALF), WINDOW_SIZE.x, WINDOW_SIZE.y)

func open_on(radio_library: RadioLibrary, screen: Vector2) -> void:
	library = radio_library
	_viz = _load_viz()
	setup(I18n.t(TITLE_KEY), initial_geometry(screen), MIN_SIZE)
	refresh()

## The folder shown ("" = the root).
func current_path() -> String:
	return _path

func entries() -> Array:
	return _entries

func items() -> Array[RadioLibraryItem]:
	return _items

func selection() -> Array:
	return _selection.keys()

func tool_buttons() -> Array:
	return [_back, _up, _home]

func address_text() -> String:
	return _field_text.text

func status_text() -> String:
	return _status_text.text

func viz_mode() -> String:
	return _viz

func viz_button() -> CssButton:
	return _viz_button

## List the folder again and lay the grid out (after a library change).
func refresh() -> void:
	_entries = library.list_dir(_path)
	for item in _items:
		item.queue_free()
	_items.clear()
	for entry in _entries:
		var item := RadioLibraryItem.new(entry)
		item.pressed.connect(_on_item_pressed)
		item.opened.connect(func(opened: RadioLibraryItem) -> void: open_entry(opened.entry))
		_grid.add_child(item)
		_items.append(item)
	var kept := {}
	for entry in _entries:
		if _selection.has(entry[RadioLibrary.PATH]):
			kept[entry[RadioLibrary.PATH]] = true
	_selection = kept
	set_title(_dir_name())
	_field_text.text = _absolute_path()
	_back.disabled = _history.is_empty()
	_up.disabled = _path.is_empty()
	for button: CssButton in [_back, _up]:
		button.modulate.a = DISABLED_OPACITY if button.disabled else 1.0
	_update_status()
	_layout_content()

## A locale change: the root's title and the status words.
func relabel() -> void:
	set_title(_dir_name())
	_update_status()
	_layout_content()

func navigate_into(folder: String) -> void:
	_history.append(_path)
	_show(folder)

func go_up() -> void:
	if not _path.is_empty():
		var slash := _path.rfind(LIBRARY_SEPARATOR)
		_show(_path.substr(0, slash) if slash >= 0 else "")

func go_back() -> void:
	if _history.is_empty():
		return
	var previous := _history[_history.size() - 1]
	_history.remove_at(_history.size() - 1)
	_show(previous)

func go_home() -> void:
	if not _path.is_empty():
		_history.append(_path)
	_show("")

## web clickItem: plain selects one, Ctrl toggles, Shift takes the range from the anchor in display order.
func select(path: String, toggle := false, extend := false) -> void:
	var paths := _entries.map(func(entry: Dictionary) -> String: return entry[RadioLibrary.PATH])
	if extend and _anchor != "" and paths.has(_anchor):
		var from := mini(paths.find(_anchor), paths.find(path))
		var to := maxi(paths.find(_anchor), paths.find(path))
		_selection = {}
		for i in range(from, to + 1):
			_selection[paths[i]] = true
	elif toggle:
		if _selection.has(path):
			_selection.erase(path)
		else:
			_selection[path] = true
		_anchor = path
	else:
		_selection = {path: true}
		_anchor = path
	for item in _items:
		item.selected = _selection.has(item.path())
	_update_status()

func clear_selection() -> void:
	_selection = {}
	_anchor = ""
	for item in _items:
		item.selected = false
	_update_status()

## A folder opens; a track plays with the folder's readable tracks as the queue.
func open_entry(entry: Dictionary) -> void:
	if entry[RadioLibrary.KIND] == RadioLibrary.FOLDER:
		navigate_into(entry[RadioLibrary.PATH])
		return
	var queue := []
	var start := -1
	for other in _entries:
		if other[RadioLibrary.KIND] != RadioLibrary.TRACK:
			continue
		var payload := library.read_track(other[RadioLibrary.PATH])
		if payload.is_empty():                     # web readMany: a corrupt sibling is skipped
			continue
		if other[RadioLibrary.PATH] == entry[RadioLibrary.PATH]:
			start = queue.size()
		queue.append(payload)
	if start >= 0:
		play_requested.emit(queue, start)

## The status bar's pill: the next visualizer mode, remembered (web localStorage radio.viz).
func cycle_viz() -> void:
	_viz = VIZ_MODES[(VIZ_MODES.find(_viz) + 1) % VIZ_MODES.size()]
	var settings := ConfigFile.new()
	settings.load(settings_path)
	settings.set_value(SETTINGS_SECTION, SETTINGS_VIZ, _viz)
	settings.save(settings_path)
	_update_status()

func _show(path: String) -> void:
	_path = path
	clear_selection()
	refresh()

func _dir_name() -> String:
	return I18n.t(TITLE_KEY) if _path.is_empty() else _path.substr(_path.rfind(LIBRARY_SEPARATOR) + 1)

## web absPath: the OS root, and the folder with the root's own separator.
func _absolute_path() -> String:
	var root := display_root if display_root != "" else library.root_abs()
	if OS.get_name() == "Windows" and display_root == "":
		root = root.replace(LIBRARY_SEPARATOR, WINDOWS_SEPARATOR)
	var separator := WINDOWS_SEPARATOR if root.contains(WINDOWS_SEPARATOR) else LIBRARY_SEPARATOR
	return root if _path.is_empty() else root + separator + _path.replace(LIBRARY_SEPARATOR, separator)

func _update_status() -> void:
	var folders := _entries.filter(func(entry: Dictionary) -> bool: return entry[RadioLibrary.KIND] == RadioLibrary.FOLDER)
	var text := STATUS_FORMAT % [_entries.size(), I18n.t(ITEMS_KEY), folders.size(), I18n.t(FOLDERS_KEY)]
	if _selection.size() > 1:
		text += SELECTED_FORMAT % _selection.size()
	_status_text.text = text
	_viz_button.text = VIZ_LABEL % [VIZ_ICONS[_viz], _viz.to_upper()]

func _load_viz() -> String:
	var settings := ConfigFile.new()
	if settings.load(settings_path) != OK:
		return VIZ_MODES[0]
	var saved = settings.get_value(SETTINGS_SECTION, SETTINGS_VIZ, VIZ_MODES[0])
	return saved if VIZ_MODES.has(saved) else VIZ_MODES[0]

func _on_item_pressed(item: RadioLibraryItem, event: InputEventMouseButton) -> void:
	if event.button_index == MOUSE_BUTTON_LEFT:
		select(item.path(), event.ctrl_pressed or event.meta_pressed, event.shift_pressed)
	elif not _selection.has(item.path()):
		select(item.path())

func _row(node_name: String) -> Control:
	var row := Panel.new()
	row.name = node_name
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.0, 0.0, 0.0, 0.0)
	box.border_color = UiTokens.SURFACE_LINE
	box.border_width_bottom = int(RULE_PX)
	row.add_theme_stylebox_override("panel", box)
	content().add_child(row)
	return row

## web .rexp-tb: a 26 px button at least 30 wide, 9 px of padding in a 1 px line border; home in the accent fill.
func _tool(node_name: String, glyph: String, families: Array, home: bool) -> CssButton:
	var button := CssButton.new()
	button.name = node_name
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var padding := Vector2(TOOL_PADDING_X, 0.0)
	if home:
		RadioButtons.dress(button, RadioButtons.outline(UiTokens.ACCENT_BRIGHT, TOOL_RADIUS, UiTokens.ACCENT_FILL, padding),
			UiTokens.INK)
	else:
		RadioButtons.dress(button, RadioButtons.outline(UiTokens.LINE, TOOL_RADIUS, Color(UiTokens.ACCENT, TOOL_FILL_ALPHA),
			padding), UiTokens.ACCENT_DIM)
		var hover := RadioButtons.outline(UiTokens.LINE, TOOL_RADIUS, Color(UiTokens.ACCENT, TOOL_HOVER_ALPHA), padding)
		for state in RadioWindow.HOVER_STATES:
			button.add_theme_stylebox_override(state, hover)
	RadioButtons.set_font(button, TOOL_PX, 0.0, families)
	var inner := TOOL_HEIGHT - 2.0 * RadioButtons.BORDER_PX
	var line := UiFont.fallback_line_px(TOOL_PX, families)
	button.css_baseline = RadioButtons.BORDER_PX + roundf((inner - line) * HALF) + UiFont.fallback_ascent_px(TOOL_PX, families)
	button.alignment = HORIZONTAL_ALIGNMENT_CENTER
	button.text = glyph
	button.custom_minimum_size = Vector2(TOOL_MIN_WIDTH, TOOL_HEIGHT)
	_tools.add_child(button)
	return button

func _layout_content() -> void:
	if _status == null:
		return
	var width := content().size.x
	var tools_height := 2.0 * TOOLS_PADDING + TOOL_HEIGHT + RULE_PX
	_tools.position = Vector2.ZERO
	_tools.size = Vector2(width, tools_height)
	var x := TOOLS_PADDING
	for button: CssButton in [_back, _up, _home]:
		var box := button.get_combined_minimum_size()
		button.position = Vector2(x, TOOLS_PADDING)
		button.size = Vector2(box.x, TOOL_HEIGHT)
		x += box.x + TOOLS_GAP
	CssBoxShadow.place(_home_glow, _home.position, _home.size)
	var address_height := 2.0 * ADDRESS_PADDING.y + FIELD_HEIGHT + RULE_PX
	_address.position = Vector2(0.0, tools_height)
	_address.size = Vector2(width, address_height)
	_field.position = ADDRESS_PADDING
	_field.size = Vector2(width - 2.0 * ADDRESS_PADDING.x, FIELD_HEIGHT)
	var field_line := roundi(UiFont.ASCENT_EM * FIELD_PX) + roundi(UiFont.DESCENT_EM * FIELD_PX)
	var text := _field_text.css_size()
	var inner_width := _field.size.x - 2.0 * (FIELD_PADDING_X + RadioButtons.BORDER_PX)
	# direction: rtl — a path wider than the field keeps its end in view
	var text_x := RadioButtons.BORDER_PX + FIELD_PADDING_X + minf(0.0, inner_width - text.x)
	# line-height: 24px from the content box, inside the border of the 24 px border-box
	_field_text.position = Vector2(text_x, RadioButtons.BORDER_PX + floorf((FIELD_HEIGHT - field_line) * HALF))
	_field_text.size = text
	_status.size = Vector2(width, STATUS_HEIGHT)
	_status.position = Vector2(0.0, content().size.y - STATUS_HEIGHT)
	var counts := _status_text.css_size()
	var status_inner := STATUS_HEIGHT - RULE_PX
	_status_text.position = Vector2(STATUS_PADDING_X, RULE_PX + floorf((status_inner - counts.y) * HALF))
	_status_text.size = counts
	_viz_button.size = VIZ_SIZE
	_viz_button.position = Vector2(width - STATUS_PADDING_X - VIZ_SIZE.x, RULE_PX + (status_inner - VIZ_SIZE.y) * HALF)
	var grid_top := tools_height + address_height
	_grid.position = Vector2(0.0, grid_top)
	_grid.size = Vector2(width, maxf(0.0, content().size.y - grid_top - STATUS_HEIGHT))
	_layout_grid()

## grid-template-columns: repeat(auto-fill, 104px): as many columns as fit, rows as tall as their tallest cell.
func _layout_grid() -> void:
	var usable := _grid.size.x - 2.0 * GRID_PADDING.x
	var columns := maxi(1, floori((usable + COLUMN_GAP) / (RadioLibraryItem.WIDTH + COLUMN_GAP)))
	var y := GRID_PADDING.y
	for row_start in range(0, _items.size(), columns):
		var row := _items.slice(row_start, row_start + columns)
		var height := 0.0
		for item: RadioLibraryItem in row:
			height = maxf(height, item.natural_height())
		for i in row.size():
			var item: RadioLibraryItem = row[i]
			item.position = Vector2(GRID_PADDING.x + i * (RadioLibraryItem.WIDTH + COLUMN_GAP), y)
			item.size = Vector2(RadioLibraryItem.WIDTH, height)
		y += height + ROW_GAP
