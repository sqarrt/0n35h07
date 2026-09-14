class_name SoundControls extends Control
## Volume sliders — port of web components/SettingsControls SoundControls, shared by SETTINGS and the in-match settings:
## the VOLUME sub-header and one slider per volume (the radio one too: the desktop build shows it), each change reported
## at once (`changed`: web persist → saveProfile + onChange). Lay it out with `layout` in its parent's CSS pixels.

signal changed(key: String, value: Variant)

const VOLUME_KEY := "settingsVolumeGroup"      # web dictionary key
## [profile key, label key] per slider.
const VOLUMES := [["volumeMaster", "settingsVolMaster"], ["volumeMusic", "settingsVolMusic"],
	["volumeMenuMusic", "settingsVolMenuMusic"], ["volumeSfx", "settingsVolSfx"], ["volumeRadio", "settingsVolRadio"]]
const RADIO_KEY := "volumeRadio"

var _header: Label
var _sliders := {}                             # profile key -> UiSlider

func _init(profile: Dictionary) -> void:
	name = "Sound"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_header = MenuText.sub_header("VolumeHeader", I18n.t(VOLUME_KEY))
	add_child(_header)
	for entry in VOLUMES:
		var key: String = entry[0]
		var slider := UiSlider.new(I18n.t(entry[1]), float(profile.get(key, 0.0)))
		slider.name = "Volume_%s" % key
		slider.value_changed.connect(func(value: Variant) -> void: changed.emit(key, value))
		add_child(slider)
		_sliders[key] = slider

## The radio slider shows on the desktop build only (web IS_DESKTOP); parity captures of the browser build hide it.
func set_radio_visible(shown: bool) -> void:
	(_sliders[RADIO_KEY] as UiSlider).visible = shown

## Place the group from `top` across `width`; returns the bottom of its last slider's margin.
func layout(top: float, width: float) -> float:
	var y := SettingsRows.header(_header, top, width)
	for key in _sliders:
		var slider := _sliders[key] as UiSlider
		if not slider.visible:
			continue
		var box := slider.get_combined_minimum_size()
		SettingsRows.place(slider, 0.0, y, Vector2(width, box.y))
		y += box.y + SettingsRows.SLIDER_MARGIN_BOTTOM
	return y
