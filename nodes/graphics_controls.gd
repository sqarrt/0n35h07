class_name GraphicsControls extends Control
## Graphics switches — port of web components/SettingsControls GraphicsControls, shared by SETTINGS and the in-match
## settings: POST-PROCESSING (outline blocks, and in the menu only the menu glow and the audio visualisation) and OVERLAY
## (FPS counter, player speed), each change reported at once (`changed`). Lay it out with `layout`.

signal changed(key: String, value: Variant)

const POSTPROC_KEY := "settingsPostproc"       # web dictionary keys
const OVERLAY_KEY := "settingsOverlayGroup"
## [profile key, label key] per switch.
const POSTPROC_TOGGLES := [["postProcessing", "settingsOutlineBlocks"], ["menuGlow", "settingsMenuGlow"],
	["audioViz", "settingsAudioViz"]]
const OVERLAY_TOGGLES := [["showFps", "settingsShowFps"], ["showSpeed", "settingsShowSpeed"]]
const MENU_ONLY := ["menuGlow", "audioViz"]    # web inMatch hides the switches that only matter in the menu

var _postproc_header: Label
var _overlay_header: Label
var _postproc_rows: Array = []                 # [UiToggle, caption Label]
var _overlay_rows: Array = []

func _init(profile: Dictionary, in_match := false) -> void:
	name = "Graphics"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_postproc_header = MenuText.sub_header("PostprocHeader", I18n.t(POSTPROC_KEY))
	add_child(_postproc_header)
	for entry in POSTPROC_TOGGLES:
		if not (in_match and MENU_ONLY.has(entry[0])):
			_postproc_rows.append(_row(profile, entry))
	_overlay_header = MenuText.sub_header("OverlayHeader", I18n.t(OVERLAY_KEY))
	add_child(_overlay_header)
	for entry in OVERLAY_TOGGLES:
		_overlay_rows.append(_row(profile, entry))

## Place the groups from `top` across `width`; returns the bottom of the last row's margin.
func layout(top: float, width: float) -> float:
	var y := SettingsRows.header(_postproc_header, top, width)
	for row in _postproc_rows:
		y = SettingsRows.toggle_row(row[0], row[1], y)
	y = SettingsRows.header(_overlay_header, y, width)
	for row in _overlay_rows:
		y = SettingsRows.toggle_row(row[0], row[1], y)
	return y

func _row(profile: Dictionary, entry: Array) -> Array:
	var key: String = entry[0]
	var toggle := UiToggle.new(bool(profile.get(key, false)))
	toggle.name = "Toggle_%s" % key
	toggle.switched.connect(func(value: Variant) -> void: changed.emit(key, value))
	add_child(toggle)
	var caption := MenuText.field_label("ToggleLabel_%s" % key, I18n.t(entry[1]))
	add_child(caption)
	return [toggle, caption]
