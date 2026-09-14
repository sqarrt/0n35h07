extends GutTest
## Settings controls against the Chrome boxes of web ui/Toggle, ui/Slider, `.input` and `.about-link`: the toggle knob 3 px
## in (19 px when on), the slider's 249.3 px track with the thumb inside its border and the 4ch percentage, the 256×41
## name field and the 18 px link.

const EPS := 0.05

func _add(control: Control) -> Control:
	add_child_autofree(control)
	return control

func test_toggle_knob_and_flip() -> void:
	var toggle := _add(UiToggle.new(false)) as UiToggle
	assert_eq(toggle.get_combined_minimum_size(), UiToggle.BOX_SIZE)
	assert_eq(toggle.knob_rect().position, Vector2(3.0, 3.0), "web knob at (344, y+3) in a box at 341")
	watch_signals(toggle)
	toggle.pressed.emit()
	assert_true(toggle.checked)
	assert_signal_emitted_with_parameters(toggle, "switched", [true])
	assert_eq(toggle.knob_rect().position, Vector2(19.0, 3.0), "on: right 2px — web 360")

func test_slider_geometry_follows_chrome() -> void:
	var slider := _add(UiSlider.new("MASTER VOLUME", 1.0)) as UiSlider
	assert_eq(slider.get_combined_minimum_size(), Vector2(UiSlider.ROW_WIDTH, 35.0), "13 label + 8 + 14 row")
	var track := slider.track_rect()
	assert_almost_eq(track.position.y, 25.0, EPS, "row at 21, the 6 px track centred in its 14 px")
	assert_almost_eq(track.size.x, 249.3, 0.1, "288 − 12.8 − 4ch")
	assert_almost_eq(slider.thumb_rect().position.x, 234.3, 0.1, "web 575.3 − 341 at 100%")
	assert_almost_eq(slider.thumb_rect().position.y, 19.0, EPS, "18 px thumb centred on the track's inside")
	assert_eq(slider.value_label().text, "100%")
	slider.set_value(0.3)
	assert_almost_eq(slider.thumb_rect().position.x, 1.0 + (track.size.x - 2.0 - UiSlider.THUMB_SIZE.x) * 0.3, EPS)
	assert_eq(slider.value_label().text, "30%")

func test_slider_drags_in_whole_percents() -> void:
	var slider := _add(UiSlider.new("EFFECTS", 0.0)) as UiSlider
	slider.size = slider.get_combined_minimum_size()
	watch_signals(slider)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	var track := slider.track_rect()
	press.position = Vector2(track.position.x + track.size.x * 0.5, track.get_center().y)
	slider._gui_input(press)
	assert_signal_emitted(slider, "value_changed")
	assert_eq(slider.value * UiSlider.PERCENT_MAX, roundf(slider.value * UiSlider.PERCENT_MAX), "whole percents")
	assert_almost_eq(slider.value, 0.5, 0.011)

func test_name_field_box() -> void:
	var field := _add(UiTextField.new("PARITY7", AppearanceConst.NAME_MAX)) as UiTextField
	assert_eq(field.get_combined_minimum_size(), Vector2(UiTextField.WIDTH, 41.0), "web input 256×41")
	assert_eq(field.max_length, AppearanceConst.NAME_MAX)

func test_link_box_and_hover_rule() -> void:
	var link := _add(UiLink.new("YouTube — @watooh", "https://www.youtube.com/@watooh")) as UiLink
	assert_eq(link.get_combined_minimum_size().y, 18.0, "15.2 px line + the 1 px border")
	assert_eq((link.get_theme_stylebox("hover") as StyleBoxFlat).border_color, UiTokens.ACCENT_DIM)
	assert_eq((link.get_theme_stylebox("normal") as StyleBoxFlat).border_color, Color.TRANSPARENT)
	watch_signals(link)
	link.pressed.emit()
	assert_signal_emitted_with_parameters(link, "opened", ["https://www.youtube.com/@watooh"])
