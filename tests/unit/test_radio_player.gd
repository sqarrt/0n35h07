extends GutTest
## RadioPlayer — web components/RadioPlayer. Docked on the menu screens: a 300 px glass card (12 / 16 px padding, a 9 px
## gap) with the track name over prev / play-pause / next, shrunk to 0.8 into the corner 18 px from the right and 44 px
## from the bottom; the transport dims to 0.45 until the engine is ready; the name opens the radio. Expanded on the Radio
## screen (window capture: the card [490, 423, 300, 209], its rows 13 / 39 / 61 / 88 / 135 / 176 px down, BACK 8 px
## under it): centred along the bottom at full size, with the trial strip and the limit line added under the volume.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const CARD := Vector2(300.0, 90.0)          # 12 + 17 (the 0.92rem line) + 9 + 38 + 12, a 1 px border twice
const BUTTON_WIDTH := (300.0 - 2.0 * 16.0 - 2.0 * 1.0 - 2.0 * 8.0) / 3.0
const ROW_TOPS := [13.0, 39.0, 61.0, 88.0, 135.0, 176.0]
const SETTLE_S := 1.0

func _player() -> RadioPlayer:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var holder := Control.new()
	holder.size = Vector2(SCREEN)
	viewport.add_child(holder)
	var player := RadioPlayer.new()
	holder.add_child(player)
	player.show_state(RadioModel.NO_TRACK, false, false)
	await wait_process_frames(2)
	return player

func _expanded() -> RadioPlayer:
	var player := await _player()
	player.show_state("proc/warden", true, true)
	player.show_details("126 BPM · E phrygian", 0.03, 137000.0)
	player.set_expanded(true, false)
	return player

func test_the_card_docks_shrunk_into_the_corner() -> void:
	var player := await _player()
	assert_eq(player.card_box(), CARD)
	assert_almost_eq(player.scale.x, RadioPlayer.COLLAPSED_SCALE, EPS)
	var shown := Rect2(player.global_position, CARD * RadioPlayer.COLLAPSED_SCALE)
	assert_almost_eq(shown.end.x, SCREEN.x - RadioPlayer.RIGHT, EPS, "right: 18px, transform-origin bottom right")
	assert_almost_eq(shown.end.y, SCREEN.y - RadioPlayer.BOTTOM, EPS, "bottom: 44px")
	assert_false(player.back_bar().visible, "docked: no BACK")
	assert_false(player.scrub().visible)

func test_the_transport_fills_its_row() -> void:
	var player := await _player()
	var buttons := player.transport_buttons()
	assert_eq(buttons.size(), 3)
	for button in buttons:
		assert_almost_eq((button as Control).size.x, BUTTON_WIDTH, 1.0, "flex 1 of 266 px less two 8 px gaps")
		assert_almost_eq((button as Control).size.y, RadioPlayer.BUTTON_HEIGHT, EPS)
	assert_eq(buttons.map(func(b: Button) -> String: return b.text), [RadioPlayer.PREV_GLYPH, RadioPlayer.PLAY_GLYPH,
		RadioPlayer.NEXT_GLYPH])

func test_dim_until_ready_and_the_play_glyph_follows_the_state() -> void:
	var player := await _player()
	assert_almost_eq(player.transport_row().modulate.a, RadioPlayer.DIM_OPACITY, EPS, "web dim: opacity 0.45")
	assert_almost_eq(player.subtitle_label().modulate.a, RadioPlayer.DIM_OPACITY, EPS)
	assert_eq(player.scrub().mouse_filter, Control.MOUSE_FILTER_IGNORE, "pointer-events: none")
	assert_eq(player.title_text(), RadioModel.NO_TRACK)
	player.show_state("Galvanic Worm IV", true, true)
	assert_almost_eq(player.transport_row().modulate.a, 1.0, EPS)
	assert_almost_eq(player.volume_row().modulate.a, 1.0, EPS, "the volume never dims")
	assert_eq(player.title_text(), "Galvanic Worm IV")
	assert_eq((player.transport_buttons()[1] as Button).text, RadioPlayer.PAUSE_GLYPH)

func test_buttons_answer_the_mouse() -> void:
	# web theme.css: .radio-player-root button:hover brightens the label and rings it, :active shrinks it to 0.92.
	var player := await _player()
	var button := player.transport_buttons()[0] as Button
	assert_eq(button.get_theme_color("font_hover_color"), RadioButtons.brighten(button.get_theme_color("font_color")))
	var ring := button.get_theme_stylebox("hover") as StyleBoxFlat
	assert_not_null(ring)
	assert_eq(ring.border_color, RadioButtons.HOVER_RING)
	assert_ne(ring.border_color, (button.get_theme_stylebox("normal") as StyleBoxFlat).border_color)
	button.button_down.emit()
	assert_almost_eq(button.scale.x, RadioButtons.PRESS_SCALE, EPS, "a press shrinks the button")
	button.button_up.emit()
	assert_almost_eq(button.scale.x, 1.0, EPS)

func test_controls_ask_for_actions() -> void:
	var player := await _player()
	player.show_state("Galvanic Worm IV", true, false)
	watch_signals(player)
	var buttons := player.transport_buttons()
	(buttons[0] as Button).pressed.emit()
	(buttons[1] as Button).pressed.emit()
	(buttons[2] as Button).pressed.emit()
	assert_signal_emitted(player, "prev_requested")
	assert_signal_emitted(player, "play_pause_requested")
	assert_signal_emitted(player, "next_requested")
	player.request_open()
	assert_signal_emitted(player, "open_requested", "the collapsed name opens the radio")

func test_expanded_rows_follow_chrome() -> void:
	var player := await _expanded()
	var rows: Array = [player.find_child("TrackName", true, false), player.subtitle_label(), player.scrub(),
		player.transport_row(), player.find_child("AirRow", true, false), player.volume_row()]
	for i in rows.size():
		assert_almost_eq((rows[i] as Control).position.y, ROW_TOPS[i], EPS, "row %d" % i)
	var expected := 26.0 + 17.0 + 13.0 + 18.0 + 38.0 + 32.0 + player.volume_row().row_height() + 5.0 * RadioPlayer.GAP
	assert_almost_eq(player.card_box().y, expected, EPS, "web 209 with the 20 px pictogram line")
	assert_eq(player.subtitle_label().text, "126 BPM · E phrygian")
	assert_eq(player.scrub().times(), ["0:04", "2:17"])
	assert_almost_eq(player.air_button().size.x, 224.0, EPS, "266 − 8 − the 34 px ball")
	assert_almost_eq(player.ball_button().position.x, 232.0, EPS)

func test_expanded_sits_centred_along_the_bottom_with_back_under_the_card() -> void:
	var player := await _expanded()
	await wait_process_frames(1)
	assert_almost_eq(player.scale.x, 1.0, EPS)
	assert_almost_eq(player.global_position.x, (SCREEN.x - RadioPlayer.WIDTH) * 0.5, EPS, "web card x 490")
	assert_almost_eq(player.global_position.y + player.size.y, SCREEN.y - RadioPlayer.BOTTOM, EPS)
	assert_true(player.back_bar().visible)
	assert_almost_eq(player.back_bar().position.y, player.card_box().y + RadioPlayer.ROOT_GAP, EPS)
	assert_eq(player.back_bar().button().text, "← %s" % I18n.t("settingsBack"))

func test_the_subtitle_before_a_track_is_the_radios_name() -> void:
	var player := await _player()
	player.show_details("", 0.0, 0.0)
	player.set_expanded(true, false)
	assert_eq(player.subtitle_label().text, I18n.t("settingsVolRadio"))
	assert_eq(player.scrub().times(), ["0:00", "0:00"])

func test_the_trial_strip_and_the_limit_line_grow_the_card() -> void:
	var player := await _expanded()
	var plain := player.card_box().y
	player.show_trial({"gens_left": 7, "saves_left": 4}, true, false)
	assert_true(player.trial_row().visible)
	assert_almost_eq(player.card_box().y, plain + RadioPlayer.GAP + RadioTrialRow.MARGIN_TOP
		+ player.trial_row().row_height(), EPS, "web 247 with the strip")
	player.show_trial({"gens_left": 0, "saves_left": 4}, true, true)
	assert_true(player.limit_label().visible)
	player.show_trial({}, false, false)
	assert_false(player.trial_row().visible, "unlimited: no strip")
	assert_almost_eq(player.card_box().y, plain, EPS)

func test_expanded_controls_ask_for_actions() -> void:
	var player := await _expanded()
	watch_signals(player)
	player.scrub().seek_requested.emit(0.5)
	player.volume_row().volume_changed.emit(0.3)
	player.ball_button().pressed.emit()
	player.air_button().pressed.emit()
	player.back_bar().pressed.emit()
	player.show_trial({"gens_left": 7, "saves_left": 4}, true, false)
	player.trial_row().unlock_requested.emit()
	assert_signal_emitted_with_parameters(player, "seek_requested", [0.5])
	assert_signal_emitted_with_parameters(player, "volume_changed", [0.3])
	assert_signal_emitted(player, "ball_toggled")
	assert_signal_emitted(player, "air_requested")
	assert_signal_emitted(player, "back_requested")
	assert_signal_emitted(player, "unlock_requested")
	player.show_ball_hidden(true)
	assert_eq(player.ball_button().text, RadioPlayer.BALL_HIDDEN)

func test_the_program_bar_sits_over_the_card_while_the_code_is_minimized() -> void:
	var player := await _expanded()
	var plain := player.size.y
	player.show_code_bar(true)
	player._process(SETTLE_S)
	var bar := player.code_bar()
	assert_true(bar.visible)
	assert_eq(bar.button().text, I18n.t("radioProgram"))
	assert_eq(Rect2(bar.position, bar.size), Rect2(0.0, 0.0, 300.0, 33.0), "web radio-code-min [490, 382, 300, 33]")
	assert_almost_eq(player.card_top(), 41.0, EPS, "8 px under the bar")
	assert_almost_eq(player.size.y, plain + 41.0, EPS, "web player 294 = 33 + 8 + 209 + 8 + 36")
	assert_almost_eq(player.global_position.y + player.size.y, SCREEN.y - RadioPlayer.BOTTOM, EPS, "the bottom stays")
	watch_signals(player)
	bar.pressed.emit()
	assert_signal_emitted(player, "code_bar_pressed")
	player.show_code_bar(false)
	assert_false(bar.visible)
	assert_almost_eq(player.size.y, plain, EPS)

func test_the_program_bar_rises_in() -> void:
	var player := await _expanded()
	player.show_code_bar(true)
	player._process(RadioPlayer.BAR_ENTER_S * 0.5)
	assert_between(player.code_bar().modulate.a, 0.01, 0.99, "rexp-bar-in: fading in")
	assert_gt(player.code_bar().position.y, 0.0, "still below its place")

func test_the_move_between_dock_and_screen_is_a_transition() -> void:
	var player := await _player()
	player.set_expanded(true)
	player._process(RadioPlayer.EXPAND_S * 0.5)
	assert_between(player.scale.x, RadioPlayer.COLLAPSED_SCALE + EPS, 1.0 - EPS, "half way through the .34 s transform")
	player._process(SETTLE_S)
	assert_almost_eq(player.scale.x, 1.0, EPS)
	assert_almost_eq(player.global_position.x, (SCREEN.x - RadioPlayer.WIDTH) * 0.5, EPS)
