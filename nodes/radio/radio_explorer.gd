class_name RadioExplorer extends RadioWindow
## The LIBRARY window of the Radio screen — web components/RadioExplorer: a RadioWindow 612×372 placed right of centre
## (x = half the screen − 306 + 170, y = 44% of it − 186), resized no smaller than 380×260, titled by the folder shown
## (the library's name at its root). Under the bar: the toolbar (back ◀, up ▲, home ⌂ — back and up at 40% when there is
## nowhere to go, home lit in the accent fill with a 12 px glow), the address bar (the folder's OS path, clicked to copy),
## the grid of folders then tracks (104 px cells 8 px apart, rows 18 px apart, inside 18 / 16 px of padding) and the
## status bar (the counts, and the visualizer's mode pill). A click selects (Ctrl toggles, Shift takes the range), a
## double click opens a folder or plays the folder's tracks from that one. A right click opens the context menu — on an
## item (selecting it first) or on the window (clearing the selection) — whose actions also answer F2 (rename in place),
## Del, Ctrl+C and Ctrl+V while the window shows and no name is being edited. Tracks drag onto a folder (or the grid) to
## move there, the selected ones together; a press on the empty grid drags a rubber band that selects every item it
## touches (with Ctrl, added to the selection). The visualizer comes with the next slice.

signal play_requested(queue: Array, start_index: int)

const WINDOW_SIZE := Vector2(612.0, 372.0)       # web W0 / H0
const MIN_SIZE := Vector2(380.0, 260.0)
const CENTRE_SHIFT := 170.0
const TOP_SHARE := 0.44
const TITLE_KEY := "radioLibrary"
const ITEMS_KEY := "radioItems"
const FOLDERS_KEY := "radioFolders"
const HOME_KEY := "radioHome"
const NEW_FOLDER_KEY := "radioCtxNewFolder"      # web lib.makeFolder(path, t.radioCtxNewFolder)
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
const FIELD_HOVER_TEXT := Color("#eeeeff")
const COPIED_S := 1.1                           # web: the ✓ flash after the path is copied
const COPIED_GLYPH := "✓"
const COPIED_PX := 13.0
const COPIED_RIGHT := 14.0
const COPIED_FAMILIES := ["Segoe UI Symbol"]
const COPIED_GLOW_BLUR := 8.0
const COPIED_GLOW_ALPHA := 0.55
const COPIED_INSET_BLUR := 10.0
const COPIED_INSET_ALPHA := 0.18
const SIGMA_PER_BLUR := 0.5
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
const DRAG_MOVE := "radio_move"                 # web DT_MOVE: the dragged tracks' library paths
const DRAG_PREVIEW_ALPHA := 0.6                 # the browser's translucent drag image

var library: RadioLibrary
var display_root := ""                          # the address bar's root (parity captures pin the web's)
var settings_path := SETTINGS_PATH
var clipboard: Callable = func(text: String) -> void: DisplayServer.clipboard_set(text)
var overlay_under: Control = null               # the rubber band goes under this sibling (web: the player's z 200 wins)

var _path := ""
var _history: PackedStringArray = []
var _entries: Array = []
var _items: Array[RadioLibraryItem] = []
var _selection := {}
var _anchor := ""
var _clip: Array = []                           # web clip: the copied tracks' paths
var _menu: RadioContextMenu = null
var _renaming := ""                             # the path whose name is being edited
var _marquee: RadioMarquee = null
var _marquee_from := Vector2.ZERO               # global
var _marquee_base := {}                         # the selection the band adds to (Ctrl) or {}
var _viz := VIZ_MODES[0]
var _tools: Control
var _back: CssButton
var _up: CssButton
var _home: CssButton
var _home_glow: ColorRect
var _address: Control
var _field: ColorRect
var _field_text: CssLabel
var _field_hovered := false
var _copied := false
var _copied_token := 0
var _copied_mark: GlowText
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
	_field = ColorRect.new()
	_field.name = "Field"
	_field.mouse_filter = Control.MOUSE_FILTER_STOP
	_field.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var field_look := ShaderMaterial.new()
	field_look.shader = RadioLibraryIcon.BOX_SHADER
	field_look.set_shader_parameter("radii", Vector4.ONE * FIELD_RADIUS)
	field_look.set_shader_parameter("top_color", FIELD_FILL)
	field_look.set_shader_parameter("bottom_color", FIELD_FILL)
	field_look.set_shader_parameter("border_px", float(RadioButtons.BORDER_PX))
	field_look.set_shader_parameter("inset_color", Color(UiTokens.OK, COPIED_INSET_ALPHA))
	_field.material = field_look
	_field.clip_contents = true
	_field.gui_input.connect(func(event: InputEvent) -> void:
		var click := event as InputEventMouseButton
		if click != null and click.button_index == MOUSE_BUTTON_LEFT and not click.pressed:
			copy_address())
	_field.mouse_entered.connect(func() -> void: _hover_field(true))
	_field.mouse_exited.connect(func() -> void: _hover_field(false))
	_address.add_child(_field)
	_field_text = CssLabel.new().styled("", FIELD_PX, 0.0, UiTokens.TEXT)
	_field_text.name = "Path"
	_field.add_child(_field_text)
	_copied_mark = GlowText.new()
	_copied_mark.name = "Copied"
	_copied_mark.configure_css(COPIED_PX, 0.0, UiTokens.OK, false, UiFont.base_with(COPIED_FAMILIES))
	_copied_mark.set_shadows([CssShadow.make(COPIED_GLOW_BLUR, Color(UiTokens.OK, COPIED_GLOW_ALPHA))])
	_copied_mark.set_text(COPIED_GLYPH)
	_copied_mark.visible = false
	_copied_mark.minimum_size_changed.connect(_layout_content)   # the glyph's box settles once the fonts apply
	_address.add_child(_copied_mark)
	_restyle_field()
	_grid = Control.new()
	_grid.name = "Grid"
	_grid.clip_contents = true
	_grid.mouse_filter = Control.MOUSE_FILTER_PASS
	_grid.gui_input.connect(_on_grid_input)
	_grid.set_drag_forwarding(Callable(), func(_at: Vector2, data: Variant) -> bool: return _is_move(data),
		func(_at: Vector2, data: Variant) -> void: move_into(_path, data[DRAG_MOVE]))
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
		item.rename_finished.connect(_on_rename_finished)
		item.set_drag_forwarding(func(_at: Vector2) -> Variant: return drag_data(item),
			func(_at: Vector2, data: Variant) -> bool: return _can_drop_into(item, data),
			func(_at: Vector2, data: Variant) -> void: _drop_into(item, data))
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
	_apply_selection()

func clear_selection() -> void:
	_selection = {}
	_anchor = ""
	_apply_selection()

func _apply_selection() -> void:
	for item in _items:
		item.selected = _selection.has(item.path())
	_update_status()

## web onDragStartTrack: a track not in the selection becomes it; the dragged paths are the selected tracks (folders
## never move this way). null for a folder or a name being edited.
func drag_data(item: RadioLibraryItem) -> Variant:
	if item.is_folder() or item.path() == _renaming:
		return null
	if not _selection.has(item.path()):
		select(item.path())
	var paths := _selected_tracks()
	if paths.is_empty():
		paths = [item.path()]
	if item.get_viewport() != null and item.get_viewport().gui_is_dragging():   # a real drag is starting
		var preview := RadioLibraryIcon.new(RadioLibraryIcon.TRACK)
		preview.modulate.a = DRAG_PREVIEW_ALPHA
		item.set_drag_preview(preview)
	return {DRAG_MOVE: paths}

## web onDropTo: the dragged tracks into `folder`, skipping any already there, the folder itself or its ancestors.
func move_into(folder: String, paths: Array) -> void:
	var moving := paths.filter(func(path: String) -> bool:
		var slash := path.rfind(LIBRARY_SEPARATOR)
		var parent := path.substr(0, slash) if slash >= 0 else ""
		return parent != folder and path != folder and not folder.begins_with(path + LIBRARY_SEPARATOR))
	if moving.is_empty():
		return
	for path in moving:
		library.move_track(path, folder)
	refresh()

## A press on the empty grid starts the band at `global_at`: the selection starts over, or from itself with Ctrl.
func begin_marquee(global_at: Vector2, additive: bool) -> void:
	_marquee_base = _selection.duplicate() if additive else {}
	_selection = _marquee_base.duplicate()
	_anchor = ""
	_apply_selection()
	_marquee_from = global_at
	_marquee = RadioMarquee.new()
	get_parent().add_child(_marquee)
	if overlay_under != null and overlay_under.get_parent() == get_parent():
		get_parent().move_child(_marquee, overlay_under.get_index())
	marquee_to(global_at)

## The band to `global_at`: every item whose box it touches (edges included) joins the base selection.
func marquee_to(global_at: Vector2) -> void:
	if _marquee == null:
		return
	var band := Rect2(_marquee_from.min(global_at), (global_at - _marquee_from).abs())
	var host := get_parent() as Control
	_marquee.place(Rect2(host.get_global_transform().affine_inverse() * band.position, band.size))
	var hit := _marquee_base.duplicate()
	for item in _items:
		var box := item.get_global_rect()
		if not (box.end.x < band.position.x or box.position.x > band.end.x or box.end.y < band.position.y
				or box.position.y > band.end.y):
			hit[item.path()] = true
	_selection = hit
	_apply_selection()

func end_marquee() -> void:
	if _marquee != null:
		_marquee.queue_free()
		_marquee = null

func marquee() -> RadioMarquee:
	return _marquee

func _on_grid_input(event: InputEvent) -> void:
	var press := event as InputEventMouseButton
	if press != null and press.pressed and press.button_index == MOUSE_BUTTON_LEFT:
		begin_marquee(press.global_position, press.ctrl_pressed or press.meta_pressed)
		_grid.accept_event()

## web document mousemove / mouseup while the band is out.
func _input(event: InputEvent) -> void:
	if _marquee == null:
		return
	var motion := event as InputEventMouseMotion
	if motion != null:
		marquee_to(motion.global_position)
		return
	var release := event as InputEventMouseButton
	if release != null and not release.pressed and release.button_index == MOUSE_BUTTON_LEFT:
		end_marquee()

static func _is_move(data: Variant) -> bool:
	return data is Dictionary and (data as Dictionary).get(DRAG_MOVE) is Array

## web onDragOver on a folder: it lights up as the drop target; tracks take no drop.
func _can_drop_into(item: RadioLibraryItem, data: Variant) -> bool:
	if not item.is_folder() or not _is_move(data):
		return false
	item.drop_target = true
	return true

func _drop_into(item: RadioLibraryItem, data: Variant) -> void:
	item.drop_target = false
	move_into(item.path(), data[DRAG_MOVE])

## A folder opens; a track plays with the folder's readable tracks as the queue.
func open_entry(entry: Dictionary) -> void:
	if entry[RadioLibrary.KIND] == RadioLibrary.FOLDER:
		navigate_into(entry[RadioLibrary.PATH])
	else:
		_play_track(entry[RadioLibrary.PATH])

## ▶ Play: a folder's readable tracks from the first, or a track with its folder (web playFolder / playTrack).
func play_entry(entry: Dictionary) -> void:
	if entry[RadioLibrary.KIND] != RadioLibrary.FOLDER:
		_play_track(entry[RadioLibrary.PATH])
		return
	var readable := _readable(library.list_dir(entry[RadioLibrary.PATH]))
	if not readable.is_empty():
		play_requested.emit(readable.values(), 0)

## The context menu at `global_at`: on `entry` (selected first, as web onContextMenu) or, with {}, on the window.
func open_menu(entry: Dictionary, global_at: Vector2) -> void:
	if _menu != null:
		_menu.close()
	if entry.is_empty():
		clear_selection()
	elif not _selection.has(entry[RadioLibrary.PATH]):
		select(entry[RadioLibrary.PATH])
	var host := get_parent() as Control
	_menu = RadioContextMenu.new()
	host.add_child(_menu)
	_menu.open(RadioExplorerMenu.items(not entry.is_empty(), _selection.size(), _selected_tracks().size(), _clip.size()),
		host.get_global_transform().affine_inverse() * global_at, host.size.x)
	_menu.chosen.connect(func(action: String) -> void: run_action(action, entry))
	_menu.closed.connect(func() -> void: _menu = null)

func context_menu() -> RadioContextMenu:
	return _menu

func clipboard_paths() -> Array:
	return _clip

func run_action(action: String, entry: Dictionary) -> void:
	match action:
		RadioExplorerMenu.PLAY:
			play_entry(entry)
		RadioExplorerMenu.NEW_FOLDER:
			new_folder()
		RadioExplorerMenu.RENAME:
			begin_rename(entry[RadioLibrary.PATH])
		RadioExplorerMenu.COPY:
			copy_selection()
		RadioExplorerMenu.PASTE:
			paste()
		RadioExplorerMenu.DELETE:
			delete_selection()

func new_folder() -> void:
	library.make_folder(_path, I18n.t(NEW_FOLDER_KEY))
	refresh()

## Del: every selected item, folders with what they hold.
func delete_selection() -> void:
	for entry in _entries:
		if _selection.has(entry[RadioLibrary.PATH]):
			library.delete_track(entry[RadioLibrary.PATH], entry[RadioLibrary.KIND] == RadioLibrary.FOLDER)
	clear_selection()
	refresh()

## Ctrl+C: the selected tracks (folders are not copied).
func copy_selection() -> void:
	_clip = _selected_tracks()

## Ctrl+V: a copy of every copied track still readable, saved into this folder under a free name.
func paste() -> void:
	for source in _clip:
		var payload := library.read_track(source)
		if not payload.is_empty():
			library.save_track(_path, payload)
	refresh()

## F2 / ✎ Rename: the item's name becomes an edit field.
func begin_rename(path: String) -> void:
	for item in _items:
		if item.path() == path:
			_renaming = path
			item.begin_rename()
			_layout_grid()
			return

func renaming() -> String:
	return _renaming

## A click on the address: the path to the clipboard, the field green with a ✓ for 1.1 s.
func copy_address() -> void:
	clipboard.call(_field_text.text)
	_copied = true
	_copied_token += 1
	var token := _copied_token
	_restyle_field()
	if is_inside_tree():
		get_tree().create_timer(COPIED_S).timeout.connect(func() -> void:
			if token == _copied_token:
				_copied = false
				_restyle_field())

func is_address_copied() -> bool:
	return _copied

func copied_mark() -> GlowText:
	return _copied_mark

func _hover_field(on: bool) -> void:
	_field_hovered = on
	_restyle_field()

## web .field / .field:hover / .field.copied (the copied look wins over hover).
func _restyle_field() -> void:
	var look := _field.material as ShaderMaterial
	var border := UiTokens.SURFACE_LINE
	var text := UiTokens.TEXT
	if _copied:
		border = UiTokens.OK
		text = UiTokens.OK
	elif _field_hovered:
		border = UiTokens.LINE
		text = FIELD_HOVER_TEXT
	look.set_shader_parameter("border_color", border)
	look.set_shader_parameter("inset_sigma", COPIED_INSET_BLUR * SIGMA_PER_BLUR if _copied else 0.0)
	_field_text.add_theme_color_override("font_color", text)
	_copied_mark.visible = _copied

func _play_track(path: String) -> void:
	var readable := _readable(_entries)
	if readable.has(path):
		play_requested.emit(readable.values(), readable.keys().find(path))

## web readMany: the tracks among `listing` that read back, path → payload in order (a corrupt one is skipped).
func _readable(listing: Array) -> Dictionary:
	var out := {}
	for entry in listing:
		if entry[RadioLibrary.KIND] != RadioLibrary.TRACK:
			continue
		var payload := library.read_track(entry[RadioLibrary.PATH])
		if not payload.is_empty():
			out[entry[RadioLibrary.PATH]] = payload
	return out

func _selected_tracks() -> Array:
	return _entries.filter(func(entry: Dictionary) -> bool:
		return entry[RadioLibrary.KIND] == RadioLibrary.TRACK and _selection.has(entry[RadioLibrary.PATH])).map(
		func(entry: Dictionary) -> String: return entry[RadioLibrary.PATH])

## web commitRename: a name that is not blank and not the old one renames (trimmed); Escape leaves it.
func _on_rename_finished(item: RadioLibraryItem, new_name: String, committed: bool) -> void:
	_renaming = ""
	if committed and not new_name.strip_edges().is_empty() and new_name != item.entry[RadioLibrary.NAME]:
		library.rename(item.path(), new_name.strip_edges())
		refresh()
	else:
		_layout_grid()

## web onContextMenu on the window: the selection cleared, the menu without item actions.
func _gui_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click != null and click.pressed and click.button_index == MOUSE_BUTTON_RIGHT:
		open_menu({}, click.global_position)
		accept_event()

## web keydown: F2 rename, Del delete, Ctrl+C copy, Ctrl+V paste — not while minimized or editing a name.
func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or not is_visible_in_tree() or not _renaming.is_empty():
		return
	var command := key.ctrl_pressed or key.meta_pressed
	if key.keycode == KEY_F2 and _selection.size() == 1:
		begin_rename(selection()[0])
	elif key.keycode == KEY_DELETE and not _selection.is_empty():
		delete_selection()
	elif command and key.keycode == KEY_C and not _selection.is_empty():
		copy_selection()
	elif command and key.keycode == KEY_V and not _clip.is_empty():
		paste()
	else:
		return
	get_viewport().set_input_as_handled()

## The menu lives beside the window (over the player): it goes when the window hides or goes.
func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE or (what == NOTIFICATION_VISIBILITY_CHANGED and not visible):
		if _menu != null:
			_menu.close()
		end_marquee()

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
	else:
		open_menu(item.entry, event.global_position)

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
	(_field.material as ShaderMaterial).set_shader_parameter("box_px", _field.size)
	# .rexp-copied: right 14 px, centred on the row's padding box (top: 50%, translateY(-50%))
	var mark_line := UiFont.fallback_line_px(COPIED_PX, COPIED_FAMILIES)
	var mark_top := (address_height - RULE_PX - mark_line) * HALF
	var mark := _copied_mark.get_combined_minimum_size()
	_copied_mark.position = Vector2(width - COPIED_RIGHT - mark.x,
		mark_top + UiFont.fallback_ascent_px(COPIED_PX, COPIED_FAMILIES) - _copied_mark.label().run().baseline())
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
