extends GutTest
## RadioPlayer's stack over the card — web RadioPlayer: the LIBRARY and PROGRAM bars of minimized windows (the one
## minimized last on top, 8 px apart), the "saves used up" line, and the expanded card dragging the audible track.

const EPS := 0.01
const SETTLE_S := 1.0

func _player() -> RadioPlayer:
	var player := RadioPlayer.new()
	add_child_autofree(player)
	player.set_expanded(true, false)
	return player

func test_the_bars_stack_with_the_last_minimized_on_top() -> void:
	var player := _player()
	player.show_library_bar(true)
	player.set_last_minimized(RadioPlayer.BAR_LIBRARY)
	player.show_code_bar(true)
	player.set_last_minimized(RadioPlayer.BAR_CODE)
	player._process(SETTLE_S)
	var step := player.code_bar().bar_height() + RadioPlayer.ROOT_GAP
	assert_almost_eq(player.code_bar().position.y, 0.0, EPS, "PROGRAM minimized last sits on top")
	assert_almost_eq(player.library_bar().position.y, step, EPS)
	assert_almost_eq(player.card_top(), 2.0 * step, EPS)
	player.set_last_minimized(RadioPlayer.BAR_LIBRARY)
	assert_almost_eq(player.library_bar().position.y, 0.0, EPS)
	player.show_library_bar(false)
	assert_false(player.library_bar().visible)
	assert_almost_eq(player.card_top(), step, EPS)
	assert_eq(player.library_bar().button().text, I18n.t("radioLibrary"))

func test_the_save_limit_line_follows_the_prompt() -> void:
	var player := _player()
	player.show_save_limited(true)
	assert_true(player.save_limit_label().visible)
	assert_eq(player.save_limit_label().text, I18n.t("radioSaveLimit"))
	player.show_save_limited(false)
	assert_false(player.save_limit_label().visible)

func test_the_expanded_card_drags_the_audible_track() -> void:
	var player := _player()
	assert_null(player.drag_data(), "nothing playing: no drag")
	player.track_payload = func() -> Dictionary: return {"name": "Twin"}
	assert_eq(player.drag_data(), {RadioExplorer.DRAG_TRACK: {"name": "Twin"}})
	player.set_expanded(false, false)
	assert_null(player.drag_data(), "docked: the name opens the radio instead")
