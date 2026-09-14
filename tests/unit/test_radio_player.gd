extends GutTest
## RadioPlayer docked — web components/RadioPlayer collapsed on the menu screens: a 300 px glass card (12 / 16 px padding,
## a 9 px gap) with the track name over prev / play-pause / next, shrunk to 0.8 into the corner 18 px from the right and
## 44 px from the bottom; the transport dims to 0.45 until the engine is ready; the name opens the radio.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const CARD := Vector2(300.0, 90.0)          # 12 + 17 (the 0.92rem line) + 9 + 38 + 12, a 1 px border twice
const BUTTON_WIDTH := (300.0 - 2.0 * 16.0 - 2.0 * 1.0 - 2.0 * 8.0) / 3.0

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

func test_the_card_docks_shrunk_into_the_corner() -> void:
	var player := await _player()
	assert_eq(player.card_box(), CARD)
	assert_almost_eq(player.scale.x, RadioPlayer.COLLAPSED_SCALE, EPS)
	var shown := Rect2(player.global_position, CARD * RadioPlayer.COLLAPSED_SCALE)
	assert_almost_eq(shown.end.x, SCREEN.x - RadioPlayer.RIGHT, EPS, "right: 18px, transform-origin bottom right")
	assert_almost_eq(shown.end.y, SCREEN.y - RadioPlayer.BOTTOM, EPS, "bottom: 44px")

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
	assert_eq(player.title_text(), RadioModel.NO_TRACK)
	player.show_state("Galvanic Worm IV", true, true)
	assert_almost_eq(player.transport_row().modulate.a, 1.0, EPS)
	assert_eq(player.title_text(), "Galvanic Worm IV")
	assert_eq((player.transport_buttons()[1] as Button).text, RadioPlayer.PAUSE_GLYPH)

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
