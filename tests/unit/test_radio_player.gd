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
const HALF := 0.5

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

func test_a_relayout_keeps_the_rows_under_the_mouse() -> void:
	# The progress poll relayouts the card several times a second; hiding a row and showing it again drops the hover
	# Godot only re-reads when the cursor moves, and cancels a press in flight (the ball button took several clicks).
	var player := await _expanded()
	var mounts := [0]
	for row: Control in [player.find_child("AirRow", true, false), player.transport_row(), player.volume_row()]:
		row.visibility_changed.connect(func() -> void: mounts[0] += 1)
	player.show_details("126 BPM · E phrygian", 0.20, 137000.0)
	player.show_state("proc/warden", true, true)
	assert_eq(mounts[0], 0, "the rows the card shows stay mounted")

func test_a_pressed_button_keeps_the_press_while_it_shrinks() -> void:
	var player := await _expanded()
	var button := player.ball_button()
	assert_true(button.keep_pressed_outside,
		"the 0.92 press must not slip the box out from under the cursor and swallow the click")
	button.button_down.emit()
	button.mouse_exited.emit()   # the shrunken box no longer reaches the cursor
	assert_almost_eq(button.scale.x, RadioButtons.PRESS_SCALE, EPS, "it stays pressed while the button is held")
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

## A real click at a screen point, through the viewport's own hit testing.
func _click(player: RadioPlayer, at: Vector2) -> void:
	var viewport := player.get_viewport()
	for pressed in [true, false]:
		var event := InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		event.position = at
		event.global_position = at
		viewport.push_input(event)
		await wait_process_frames(1)

func test_the_docked_card_takes_the_mouse_where_it_is_drawn() -> void:
	# Bug: docked, the card is drawn shrunk to 0.8 in the corner — the mouse has to hit it there.
	var player := await _player()
	player.show_state("Brutal Warden /126", true, true)
	await wait_process_frames(2)
	watch_signals(player)
	var play := player.transport_buttons()[1] as Button
	await _click(player, play.get_global_transform() * (play.size * HALF))
	assert_signal_emitted(player, "play_pause_requested", "the play button under the cursor is the one drawn there")
	var title: Control = player.find_child("TrackName", true, false)
	await _click(player, title.get_global_transform() * (title.size * HALF))
	assert_signal_emitted(player, "open_requested", "and the name opens the radio")

## A real press / move / release at screen points, through the viewport's own hit testing.
func _press(player: RadioPlayer, at: Vector2, pressed: bool) -> void:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	event.position = at
	event.global_position = at
	player.get_viewport().push_input(event)
	await wait_process_frames(1)

func _move(player: RadioPlayer, at: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.position = at
	motion.global_position = at
	motion.button_mask = MOUSE_BUTTON_MASK_LEFT
	player.get_viewport().push_input(motion)
	await wait_process_frames(1)

func test_the_scrub_is_grabbed_by_a_press_and_let_go_by_the_release() -> void:
	# Bug: the card relayouts several times a second with the progress, and that used to drop the grab — so seeking
	# took two clicks (one to take the slider, another to let it go).
	var player := await _expanded()
	player.show_state("proc/warden", true, true)
	await wait_process_frames(2)
	var scrub := player.scrub()
	var rail := scrub.rail_box()
	watch_signals(player)
	await _press(player, scrub.get_global_transform() * (rail.position + Vector2(rail.size.x * 0.25, rail.size.y * HALF)), true)
	player.show_details("126 BPM · E phrygian", 0.3, 137000.0)   # the poll lands in the middle of the drag
	await _move(player, scrub.get_global_transform() * (rail.position + Vector2(rail.size.x * 0.6, rail.size.y * HALF)))
	assert_signal_not_emitted(player, "seek_requested", "nothing is asked for while the slider is held")
	await _press(player, scrub.get_global_transform() * (rail.position + Vector2(rail.size.x * 0.6, rail.size.y * HALF)), false)
	assert_signal_emitted(player, "seek_requested", "letting go seeks, on the first click")
	var asked: float = get_signal_parameters(player, "seek_requested")[0]
	assert_almost_eq(asked, 0.6, 0.05, "where the pointer let go")

func test_the_volume_slider_is_let_go_when_the_button_is() -> void:
	# The same dropped grab made the volume slider stick to the pointer until the next click.
	var player := await _expanded()
	player.show_state("proc/warden", true, true)
	await wait_process_frames(2)
	var slider := player.volume_row().range_input()
	var track := slider.track_rect()
	var at := func(share: float) -> Vector2:
		return slider.get_global_transform() * (track.position + Vector2(track.size.x * share, track.size.y * HALF))
	watch_signals(player)
	await _press(player, at.call(0.3), true)
	player.show_details("126 BPM · E phrygian", 0.4, 137000.0)
	await _move(player, at.call(0.7))
	await _press(player, at.call(0.7), false)
	var volume: float = slider.value
	assert_almost_eq(volume, 0.7, 0.1, "the drag followed the pointer")
	await _move(player, at.call(0.1))
	assert_almost_eq(slider.value, volume, EPS, "and the slider stays where it was let go")
