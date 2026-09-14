class_name MatchSettings extends Control
## In-match settings — port of web components/MatchSettings, shown inside the pause overlay: the SETTINGS title, the
## SOUND / GRAPHICS tabs (SOUND on every visit), the shared SoundControls / GraphicsControls (without the menu-only
## switches) in a min(28rem, 80vw) block and BACK, one column centred on the screen (web `.screen`). Every change is
## reported at once (`profile_changed`: the arena saves the profile and applies it live).

signal back_requested
signal profile_changed(profile: Dictionary)

const TAB_SOUND := "sound"
const TAB_GRAPHICS := "graphics"
const TAB_KEYS := {TAB_SOUND: "settingsSecSound", TAB_GRAPHICS: "settingsSecGraphics"}   # web dictionary keys
const TITLE_KEY := "settingsTitle"
const BACK_KEY := "settingsBack"
const TITLE_MARGIN_BOTTOM := 22.4              # h2 marginBottom 1.4rem
const TABS_MARGIN_BOTTOM := 25.6               # the tabs row: marginBottom 1.6rem (gap 0.6rem)
const BLOCK_WIDTH := 448.0                     # the controls block: width min(28rem, 80vw)
const BLOCK_VIEWPORT_SHARE := 0.8
const HALF := 0.5

var profile := {}
var tab := TAB_SOUND
var radio_shown := true                        # web SoundControls: the radio slider is the desktop build's

var _title: Label
var _tabs := {}                                # tab -> SegButton
var _sound: SoundControls
var _graphics: GraphicsControls
var _back: UiButton

## The live profile the panel edits in place.
func setup(edited: Dictionary) -> void:
	profile = edited

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_title = MenuText.title("Title", I18n.t(TITLE_KEY))
	add_child(_title)
	for id in TAB_KEYS:
		var seg := SegButton.new(I18n.t(TAB_KEYS[id]))
		seg.name = "Tab_%s" % id
		seg.pressed.connect(select_tab.bind(id))   # web setTab: a plain .seg, no UI sound
		add_child(seg)
		_tabs[id] = seg
	_sound = SoundControls.new(profile)
	_sound.changed.connect(_on_control)
	_sound.set_radio_visible(radio_shown)
	add_child(_sound)
	_graphics = GraphicsControls.new(profile, true)
	_graphics.changed.connect(_on_control)
	add_child(_graphics)
	_back = UiButton.new(I18n.t(BACK_KEY), UiButton.GHOST)
	_back.name = "Back"
	_back.pressed.connect(func() -> void: back_requested.emit())
	add_child(_back)
	resized.connect(_layout)
	_show_tab()

func select_tab(id: String) -> void:
	tab = id
	if _back != null:
		_show_tab()

## The browser build's panel (parity captures) has no radio slider.
func set_radio_visible(shown: bool) -> void:
	radio_shown = shown
	if _sound != null:
		_sound.set_radio_visible(shown)
		_layout()

func _show_tab() -> void:
	_sound.visible = tab == TAB_SOUND
	_graphics.visible = tab == TAB_GRAPHICS
	for id in _tabs:
		(_tabs[id] as SegButton).set_on(id == tab)
	_layout()

func _layout() -> void:
	var width := minf(BLOCK_WIDTH, size.x * BLOCK_VIEWPORT_SHARE)
	var block_height := _sound.layout(0.0, width) if tab == TAB_SOUND else _graphics.layout(0.0, width)
	var title := _title.get_combined_minimum_size()
	var tabs_width := SettingsRows.ROW_GAP * (_tabs.size() - 1)
	var tabs_height := 0.0
	for id in _tabs:
		var box := (_tabs[id] as SegButton).get_combined_minimum_size()
		tabs_width += box.x
		tabs_height = maxf(tabs_height, box.y)
	var back := _back.get_combined_minimum_size()
	var column_height := title.y + TITLE_MARGIN_BOTTOM + tabs_height + TABS_MARGIN_BOTTOM + block_height \
		+ 2.0 * UiButton.MARGIN_Y + back.y
	var centre := size.x * HALF
	var y := (size.y - column_height) * HALF
	SettingsRows.place(_title, centre - title.x * HALF, y, title)
	y += title.y + TITLE_MARGIN_BOTTOM
	var x := centre - tabs_width * HALF
	for id in _tabs:
		var box := (_tabs[id] as SegButton).get_combined_minimum_size()
		SettingsRows.place(_tabs[id], x, y, box)
		x += box.x + SettingsRows.ROW_GAP
	y += tabs_height + TABS_MARGIN_BOTTOM
	for group in [_sound, _graphics]:
		(group as Control).position = Vector2(CssPixel.snap(centre - width * HALF), 0.0)
		(group as Control).size = Vector2(width, size.y)
	if tab == TAB_SOUND:
		_sound.layout(y, width)
	else:
		_graphics.layout(y, width)
	SettingsRows.place(_back, centre - back.x * HALF, y + block_height + UiButton.MARGIN_Y, back)

func _on_control(key: String, value: Variant) -> void:
	profile[key] = value
	profile_changed.emit(profile)
