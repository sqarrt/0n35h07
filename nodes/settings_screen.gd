class_name SettingsScreen extends Control
## The settings screen — port of web screens/Settings with components/SettingsControls as the desktop build shows it
## (settingsSections hides NETWORK there): the SETTINGS title and the section tabs at the top of the panel, one section
## under them — PLAYER (the name, the default view, the language grid), SOUND (the volume sliders, radio included) or
## GRAPHICS (the post-processing and overlay switches) — and BACK pinned to the panel's bottom. Every change writes the
## profile at once (`profile_changed`: web saveProfile + onChange). Texts are the English dictionary until i18n lands.

signal back_requested
signal profile_changed(profile: Dictionary)
signal section_changed(section: String)

const SECTION_PLAYER := "player"
const SECTION_SOUND := "sound"
const SECTION_NET := "net"
const SECTION_GRAPHICS := "graphics"
const ALL_SECTIONS := [SECTION_PLAYER, SECTION_SOUND, SECTION_NET, SECTION_GRAPHICS]
const SECTION_TEXTS := {SECTION_PLAYER: "PLAYER", SECTION_SOUND: "SOUND", SECTION_NET: "NETWORK",
	SECTION_GRAPHICS: "GRAPHICS"}                    # web en settingsSec*
const TITLE_TEXT := "SETTINGS"                     # settingsTitle
const NAME_TEXT := "NAME"                          # settingsName
const VIEW_TEXT := "DEFAULT VIEW"                  # settingsDefaultView
const VIEW_TEXTS := {AppearanceConst.VIEW_FIRST_PERSON: "FIRST PERSON", AppearanceConst.VIEW_THIRD_PERSON: "THIRD PERSON"}
const LANGUAGE_TEXT := "LANGUAGE"                  # settingsLanguage
const VOLUME_TEXT := "VOLUME"                      # settingsVolumeGroup
## [profile key, label] per slider (web SoundControls; the radio one is desktop-only).
const VOLUMES := [["volumeMaster", "MASTER VOLUME"], ["volumeMusic", "IN-GAME MUSIC"], ["volumeMenuMusic", "MENU MUSIC"],
	["volumeSfx", "EFFECTS"], ["volumeRadio", "Radio"]]
const POSTPROC_TEXT := "POST-PROCESSING"            # settingsPostproc
const OVERLAY_TEXT := "OVERLAY"                    # settingsOverlayGroup
const POSTPROC_TOGGLES := [["postProcessing", "OUTLINE BLOCKS"], ["menuGlow", "MENU GLOW"],
	["audioViz", "AUDIO VISUALIZATION"]]
const OVERLAY_TOGGLES := [["showFps", "SHOW FPS COUNTER"], ["showSpeed", "SHOW PLAYER SPEED"]]
const BACK_TEXT := "BACK"                          # settingsBack
const PROFILE_NAME := "name"
const PROFILE_VIEW := "defaultView"
const ROW_GAP := 9.6                               # row: gap 0.6rem
const ROW_MARGIN_BOTTOM := 25.6                    # row: marginBottom 1.6rem (and the 1.6rem field blocks)
const TABS_MARGIN_BOTTOM := 28.8                   # the tabs row: 1.8rem
const LABEL_MARGIN_BOTTOM := 9.6                   # label: marginBottom 0.6rem
const LANG_COLUMNS := 5                            # LANG_GRID_COLS
const LANG_GAP := 6.4                              # grid gap 0.4rem
const LANG_TILE_PX := 12.48                        # langTile: 0.78rem bold, spaced 0.02em, 0.5rem / 0.3rem padding
const LANG_TILE_SPACING_EM := 0.02
const LANG_TILE_PADDING := Vector2(4.8, 8.0)
const CJK_LOCALE := "zh-CN"                        # its native name needs the --ui-font CJK fallbacks
const CJK_LINE_ADJUST := -1                        # measured with Microsoft YaHei: Chrome's row 34 px, Godot's line 35
const SLIDER_MARGIN_BOTTOM := 22.4                 # Slider: marginBottom 1.4rem
const TOGGLE_GAP := 14.4                           # ToggleRow gap 0.9rem
const HALF := 0.5

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
var _volume_header: Label
var _sliders := {}                                 # profile key -> UiSlider
var _postproc_header: Label
var _overlay_header: Label
var _toggles := {}                                 # profile key -> [UiToggle, Label]

## The desktop build has no NETWORK tab (web visibleSections).
static func visible_sections(desktop: bool) -> Array:
	return ALL_SECTIONS.filter(func(id: String) -> bool: return not (desktop and id == SECTION_NET))

## The profile the screen edits in place and the tab to open (web keeps the last one across visits).
func setup(edited: Dictionary, open_section := SECTION_PLAYER) -> void:
	profile = edited
	section = open_section if visible_sections(true).has(open_section) else SECTION_PLAYER

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_title = MenuText.title("Title", TITLE_TEXT)
	add_child(_title)
	for id in visible_sections(true):
		var tab := SegButton.new(SECTION_TEXTS[id])
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
	_back = UiButton.new(BACK_TEXT, UiButton.GHOST)
	_back.name = "Back"
	_back.pressed.connect(func() -> void: back_requested.emit())
	add_child(_back)
	_show_section()
	resized.connect(_layout)
	_layout()

func page(id: String) -> Control:
	return _pages[id]

func _build_player(page_node: Control) -> void:
	_name_label = _add(page_node, MenuText.field_label("NameLabel", NAME_TEXT))
	_name_field = UiTextField.new(profile.get(PROFILE_NAME, ""), AppearanceConst.NAME_MAX)
	_name_field.name = "Name"
	_name_field.text_changed.connect(_on_name)
	page_node.add_child(_name_field)
	_view_label = _add(page_node, MenuText.field_label("ViewLabel", VIEW_TEXT))
	for view in VIEW_TEXTS:
		var seg := SegButton.new(VIEW_TEXTS[view])
		seg.name = "View_%s" % view
		seg.pressed.connect(_on_view.bind(view))
		page_node.add_child(seg)
		_view_segs[view] = seg
	_language_label = _add(page_node, MenuText.field_label("LanguageLabel", LANGUAGE_TEXT))
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
	_volume_header = _add(page_node, MenuText.sub_header("VolumeHeader", VOLUME_TEXT))
	for entry in VOLUMES:
		var slider := UiSlider.new(entry[1], float(profile.get(entry[0], 0.0)))
		slider.name = "Volume_%s" % entry[0]
		slider.value_changed.connect(_on_setting.bind(entry[0]))
		page_node.add_child(slider)
		_sliders[entry[0]] = slider

func _build_graphics(page_node: Control) -> void:
	_postproc_header = _add(page_node, MenuText.sub_header("PostprocHeader", POSTPROC_TEXT))
	for entry in POSTPROC_TOGGLES:
		_add_toggle(page_node, entry)
	_overlay_header = _add(page_node, MenuText.sub_header("OverlayHeader", OVERLAY_TEXT))
	for entry in OVERLAY_TOGGLES:
		_add_toggle(page_node, entry)

func _add_toggle(page_node: Control, entry: Array) -> void:
	var toggle := UiToggle.new(bool(profile.get(entry[0], false)))
	toggle.name = "Toggle_%s" % entry[0]
	toggle.switched.connect(_on_setting.bind(entry[0]))
	page_node.add_child(toggle)
	var caption := _add(page_node, MenuText.field_label("ToggleLabel_%s" % entry[0], entry[1]))
	_toggles[entry[0]] = [toggle, caption]

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
		_set_box(_tabs[id], x, y, box)
		x += box.x + ROW_GAP
		tab_height = box.y
	y += tab_height + TABS_MARGIN_BOTTOM
	for id in _pages:
		(_pages[id] as Control).size = size
	_layout_player(y, width)
	_layout_sound(y, width)
	_layout_graphics(y, width)
	_back.custom_minimum_size.x = width
	_set_box(_back, 0.0, size.y - UiButton.MARGIN_Y - UiButton.BUTTON_HEIGHT, Vector2(width, UiButton.BUTTON_HEIGHT))

func _layout_player(top: float, width: float) -> void:
	var y := _place(_name_label, 0.0, top) + LABEL_MARGIN_BOTTOM
	var field := _name_field.get_combined_minimum_size()
	_set_box(_name_field, 0.0, y, field)
	y = _place(_view_label, 0.0, y + field.y + ROW_MARGIN_BOTTOM) + LABEL_MARGIN_BOTTOM
	var x := 0.0
	var seg_height := 0.0
	for view in _view_segs:
		var box: Vector2 = (_view_segs[view] as SegButton).get_combined_minimum_size()
		_set_box(_view_segs[view], x, y, box)
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
	var y := _place_header(_volume_header, top, width)
	for key in _sliders:
		var slider := _sliders[key] as UiSlider
		var box := slider.get_combined_minimum_size()
		_set_box(slider, 0.0, y, Vector2(width, box.y))
		y += box.y + SLIDER_MARGIN_BOTTOM

func _layout_graphics(top: float, width: float) -> void:
	var y := _place_header(_postproc_header, top, width)
	for entry in POSTPROC_TOGGLES:
		y = _place_toggle(entry[0], y)
	y = _place_header(_overlay_header, y, width)
	for entry in OVERLAY_TOGGLES:
		y = _place_toggle(entry[0], y)

## A sub-header across the column; returns the top of what follows its margin.
func _place_header(header: Label, top: float, width: float) -> float:
	var height := header.get_combined_minimum_size().y
	_set_box(header, 0.0, top, Vector2(width, height))
	return top + height + MenuText.SUB_HEADER_MARGIN_BOTTOM

## A ToggleRow: the switch, then its caption centred on the row (align-items: center).
func _place_toggle(key: String, top: float) -> float:
	var toggle := _toggles[key][0] as UiToggle
	var caption := _toggles[key][1] as Label
	_set_box(toggle, 0.0, top, UiToggle.BOX_SIZE)
	var caption_box := caption.get_combined_minimum_size()
	_set_box(caption, UiToggle.BOX_SIZE.x + TOGGLE_GAP, top + (UiToggle.BOX_SIZE.y - caption_box.y) * HALF, caption_box)
	return top + UiToggle.BOX_SIZE.y + ROW_MARGIN_BOTTOM

func _place(label: Label, x: float, y: float) -> float:
	var box := label.get_combined_minimum_size()
	_set_box(label, x, y, box)
	return y + box.y

## A box at a fractional CSS position, painted from whole pixels like Chrome.
func _set_box(control: Control, x: float, y: float, box: Vector2) -> void:
	control.position = Vector2(CssPixel.snap(x), CssPixel.snap(y))
	control.size = box

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
	profile[Locales.PROFILE_KEY] = id
	_refresh_player()
	profile_changed.emit(profile)

func _on_setting(value: Variant, key: String) -> void:
	profile[key] = value
	profile_changed.emit(profile)
