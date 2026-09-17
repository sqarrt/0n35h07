class_name SettingsScreen extends Control
## The settings screen — port of web screens/Settings with components/SettingsControls as the desktop build shows it
## (settingsSections hides NETWORK there): the SETTINGS title and the section tabs at the top of the panel, one section
## under them — PLAYER (the name, the default view, the language grid), SOUND (the volume sliders, radio included) or
## GRAPHICS (the post-processing and overlay switches) — and BACK pinned to the panel's bottom. Every change writes the
## profile at once (`profile_changed`: web saveProfile + onChange); a new language also asks for the interface to be
## rebuilt in it (`locale_changed`: web setLocale).

signal back_requested
signal profile_changed(profile: Dictionary)
signal section_changed(section: String)
signal locale_changed(locale: String)

const SECTION_PLAYER := "player"
const SECTION_SOUND := "sound"
const SECTION_NET := "net"
const SECTION_GRAPHICS := "graphics"
const ALL_SECTIONS := [SECTION_PLAYER, SECTION_SOUND, SECTION_NET, SECTION_GRAPHICS]
const SECTION_KEYS := {SECTION_PLAYER: "settingsSecPlayer", SECTION_SOUND: "settingsSecSound",
	SECTION_NET: "settingsSecNet", SECTION_GRAPHICS: "settingsSecGraphics"}   # web dictionary keys
const TITLE_KEY := "settingsTitle"
const NAME_KEY := "settingsName"
const VIEW_KEY := "settingsDefaultView"
const VIEW_KEYS := {AppearanceConst.VIEW_FIRST_PERSON: "settingsViewFp",
	AppearanceConst.VIEW_THIRD_PERSON: "settingsViewTp"}
const LANGUAGE_KEY := "settingsLanguage"
const BACK_KEY := "settingsBack"
const PROFILE_NAME := "name"
const PROFILE_VIEW := "defaultView"
const ROW_GAP := SettingsRows.ROW_GAP
const ROW_MARGIN_BOTTOM := SettingsRows.ROW_MARGIN_BOTTOM
const TABS_MARGIN_BOTTOM := 28.8                   # the tabs row: 1.8rem
const LABEL_MARGIN_BOTTOM := 9.6                   # label: marginBottom 0.6rem
const LANG_COLUMNS := 5                            # LANG_GRID_COLS
const LANG_GAP := 6.4                              # grid gap 0.4rem
const LANG_TILE_PX := 12.48                        # langTile: 0.78rem bold, spaced 0.02em, 0.5rem / 0.3rem padding
const LANG_TILE_SPACING_EM := 0.02
const LANG_TILE_PADDING := Vector2(4.8, 8.0)
const CJK_LOCALE := "zh-CN"                        # its native name needs the --ui-font CJK fallbacks
const CJK_LINE_ADJUST := -1                        # measured with Microsoft YaHei: Chrome's row 34 px, Godot's line 35

var profile := {}
var section := SECTION_PLAYER

var _title: Label
var _tabs := {}                                    # section -> SegButton
var _pages := {}                                   # section -> Control
var _back: UiButton
var _name_label: Label
var _name_field: UiTextField
var _view_label: Label
var _view_segs := {}                               # view -> SegButton
var _language_label: Label
var _lang_tiles := {}                              # locale -> UiButton
var _sound: SoundControls
var _graphics: GraphicsControls

## The desktop build has no NETWORK tab (web visibleSections).
static func visible_sections(desktop: bool) -> Array:
	return ALL_SECTIONS.filter(func(id: String) -> bool: return not (desktop and id == SECTION_NET))

## The profile the screen edits in place and the tab to open (web keeps the last one across visits).
func setup(edited: Dictionary, open_section := SECTION_PLAYER) -> void:
	profile = edited
	section = open_section if visible_sections(true).has(open_section) else SECTION_PLAYER

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_title = MenuText.title("Title", I18n.t(TITLE_KEY))
	add_child(_title)
	for id in visible_sections(true):
		var tab := SegButton.new(I18n.t(SECTION_KEYS[id]))
		tab.name = "Tab_%s" % id
		tab.pressed.connect(_on_tab.bind(id))
		add_child(tab)
		_tabs[id] = tab
		var page := Control.new()
		page.name = "Page_%s" % id
		page.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(page)
		_pages[id] = page
	_build_player(_pages[SECTION_PLAYER])
	_build_sound(_pages[SECTION_SOUND])
	_build_graphics(_pages[SECTION_GRAPHICS])
	_back = UiButton.new(I18n.t(BACK_KEY), UiButton.GHOST)
	_back.name = "Back"
	_back.pressed.connect(func() -> void: back_requested.emit())
	add_child(_back)
	_show_section()
	resized.connect(_layout)
	_layout()

func page(id: String) -> Control:
	return _pages[id]

func _build_player(page_node: Control) -> void:
	_name_label = _add(page_node, MenuText.field_label("NameLabel", I18n.t(NAME_KEY)))
	_name_field = UiTextField.new(profile.get(PROFILE_NAME, ""), AppearanceConst.NAME_MAX)
	_name_field.name = "Name"
	_name_field.text_changed.connect(_on_name)
	page_node.add_child(_name_field)
	_view_label = _add(page_node, MenuText.field_label("ViewLabel", I18n.t(VIEW_KEY)))
	for view in VIEW_KEYS:
		var seg := SegButton.new(I18n.t(VIEW_KEYS[view]))
		seg.name = "View_%s" % view
		seg.pressed.connect(_on_view.bind(view))
		page_node.add_child(seg)
		_view_segs[view] = seg
	_language_label = _add(page_node, MenuText.field_label("LanguageLabel", I18n.t(LANGUAGE_KEY)))
	for id in Locales.ids():
		var metrics := UiButton.Metrics.new()
		metrics.font_px = LANG_TILE_PX
		metrics.spacing_em = LANG_TILE_SPACING_EM
		metrics.padding = LANG_TILE_PADDING
		metrics.min_width = 0.0
		metrics.always_bold = true
		if id == CJK_LOCALE:   # a CJK fallback raises the whole line: only this tile takes it
			metrics.face = UiFont.base_cjk()
			metrics.line_adjust = CJK_LINE_ADJUST
		var tile := UiButton.new(Locales.NATIVE[id], UiButton.SECONDARY, true, metrics)
		tile.name = "Lang_%s" % id
		tile.pressed.connect(_on_locale.bind(id))
		page_node.add_child(tile)
		_lang_tiles[id] = tile
	_refresh_player()

func _build_sound(page_node: Control) -> void:
	_sound = SoundControls.new(profile)
	_sound.changed.connect(_on_control)
	page_node.add_child(_sound)

func _build_graphics(page_node: Control) -> void:
	_graphics = GraphicsControls.new(profile)
	_graphics.changed.connect(_on_control)
	page_node.add_child(_graphics)

func _add(page_node: Control, label: Label) -> Label:
	page_node.add_child(label)
	return label

func _layout() -> void:
	var width := size.x
	var y := get_viewport_rect().size.y * MenuText.SCREEN_TOP_SHARE
	y = _place(_title, 0.0, y) + MenuText.TITLE_MARGIN_BOTTOM
	var x := 0.0
	var tab_height := 0.0
	for id in _tabs:
		var box: Vector2 = (_tabs[id] as SegButton).get_combined_minimum_size()
		SettingsRows.place(_tabs[id], x, y, box)
		x += box.x + ROW_GAP
		tab_height = box.y
	y += tab_height + TABS_MARGIN_BOTTOM
	for id in _pages:
		(_pages[id] as Control).size = size
	_layout_player(y, width)
	_layout_sound(y, width)
	_layout_graphics(y, width)
	_back.custom_minimum_size.x = width
	var back_height := _back.get_combined_minimum_size().y   # a Chinese label's taller line grows the button
	SettingsRows.place(_back, 0.0, size.y - UiButton.MARGIN_Y - back_height, Vector2(width, back_height))

func _layout_player(top: float, width: float) -> void:
	var y := _place(_name_label, 0.0, top) + LABEL_MARGIN_BOTTOM
	var field := _name_field.get_combined_minimum_size()
	SettingsRows.place(_name_field, 0.0, y, field)
	y = _place(_view_label, 0.0, y + field.y + ROW_MARGIN_BOTTOM) + LABEL_MARGIN_BOTTOM
	var x := 0.0
	var seg_height := 0.0
	for view in _view_segs:
		var box: Vector2 = (_view_segs[view] as SegButton).get_combined_minimum_size()
		SettingsRows.place(_view_segs[view], x, y, box)
		x += box.x + ROW_GAP
		seg_height = box.y
	y = _place(_language_label, 0.0, y + seg_height + ROW_MARGIN_BOTTOM) + LABEL_MARGIN_BOTTOM
	var tile_width := (width - LANG_GAP * (LANG_COLUMNS - 1)) / LANG_COLUMNS
	var ids := Locales.ids()
	for row_start in range(0, ids.size(), LANG_COLUMNS):
		var row: Array = ids.slice(row_start, row_start + LANG_COLUMNS)
		var row_height := 0.0
		for id in row:
			row_height = maxf(row_height, (_lang_tiles[id] as UiButton).get_combined_minimum_size().y)
		for column in row.size():
			_set_edges(_lang_tiles[row[column]], column * (tile_width + LANG_GAP), y, tile_width, row_height)
		y += row_height + LANG_GAP

func _layout_sound(top: float, width: float) -> void:
	_sound.size = size
	_sound.layout(top, width)

func _layout_graphics(top: float, width: float) -> void:
	_graphics.size = size
	_graphics.layout(top, width)

func _place(label: Label, x: float, y: float) -> float:
	var box := label.get_combined_minimum_size()
	SettingsRows.place(label, x, y, box)
	return y + box.y

## A box with fractional CSS edges (the 1fr grid tiles), each edge on a whole pixel.
func _set_edges(control: Control, x: float, y: float, width: float, height: float) -> void:
	var left := CssPixel.snap(x)
	var top := CssPixel.snap(y)
	control.position = Vector2(left, top)
	control.size = Vector2(CssPixel.snap(x + width) - left, CssPixel.snap(y + height) - top)

func _show_section() -> void:
	for id in _pages:
		(_pages[id] as Control).visible = id == section
		(_tabs[id] as SegButton).set_on(id == section)

func _refresh_player() -> void:
	for view in _view_segs:
		(_view_segs[view] as SegButton).set_on(profile.get(PROFILE_VIEW) == view)
	var locale := Locales.of_profile(profile)
	for id in _lang_tiles:
		(_lang_tiles[id] as UiButton).set_variant(UiButton.PRIMARY if id == locale else UiButton.SECONDARY)

## Open a tab (web setSection), as its button does.
func select_section(id: String) -> void:
	section = id
	_show_section()
	section_changed.emit(id)

func _on_tab(id: String) -> void:
	if id == section:
		return
	UiSounds.toggle()
	select_section(id)

func _on_name(value: String) -> void:
	profile[PROFILE_NAME] = value.left(AppearanceConst.NAME_MAX)
	profile_changed.emit(profile)

func _on_view(view: String) -> void:
	if profile.get(PROFILE_VIEW) != view:
		UiSounds.toggle()
	profile[PROFILE_VIEW] = view
	_refresh_player()
	profile_changed.emit(profile)

func _on_locale(id: String) -> void:
	var changed := id != I18n.locale()
	profile[Locales.PROFILE_KEY] = id
	_refresh_player()
	profile_changed.emit(profile)
	if changed:
		locale_changed.emit(id)

func _on_control(key: String, value: Variant) -> void:
	profile[key] = value
	profile_changed.emit(profile)
