extends GutTest
## Lobby seat parity with the web Seats card: the free host seat's ADD A BOT zone, the underlined own name, the host's
## bot controls (name, difficulty, ✕, reroll), dashed until ready, and the card heights.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const SLOT := 1
const HUMAN := {"id": 0, "name": "PARITY7", "color": "#ffaa44", "kind": "human"}
const BOT := {"id": 1, "name": "EX82R", "color": "#ffdd44", "kind": "bot", "difficulty": "passive"}

func _seat(compact := false) -> LobbySeat:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var seat := LobbySeat.new()
	seat.slot = SLOT
	seat.compact = compact
	viewport.add_child(seat)
	return seat

func test_a_free_host_seat_offers_a_bot() -> void:
	var seat := _seat()
	seat.show_seat(null, false, false, true)
	var zone := seat.find_child("AddBot", true, false) as Button
	assert_eq(zone.text, "ADD A BOT")
	watch_signals(seat)
	zone.pressed.emit()
	assert_signal_emitted_with_parameters(seat, "add_bot_requested", [SLOT])
	assert_almost_eq(seat.get_combined_minimum_size().y, LobbySeat.MIN_HEIGHT, EPS, "min-height: 108px")
	assert_true(seat.is_dashed())

func test_the_own_name_is_underlined() -> void:
	var seat := _seat()
	seat.show_seat(HUMAN, true, false, true)
	var nick := seat.find_child("Nick", true, false) as LobbySeat.Nick
	assert_eq(nick.text, "PARITY7")
	assert_true(nick.underline, "web lobby-nick--you")
	assert_eq(nick.get_theme_color("font_color"), Color("#ffaa44"), "in the player's colour")
	assert_true(seat.is_dashed(), "not ready yet")

func test_the_host_bot_seat_controls() -> void:
	var seat := _seat()
	seat.show_seat(BOT, false, true, true)
	assert_eq((seat.find_child("BotName", true, false) as LineEdit).text, "EX82R")
	var passive := seat.find_child("Passive", true, false) as SegButton
	var normal := seat.find_child("Normal", true, false) as SegButton
	assert_true(passive.is_on())
	assert_false(normal.is_on())
	assert_false(seat.is_dashed(), "a ready seat turns solid")
	watch_signals(seat)
	normal.pressed.emit()
	assert_signal_emitted_with_parameters(seat, "bot_difficulty_picked", [SLOT, "normal"])
	(seat.find_child("Remove", true, false) as Button).pressed.emit()
	assert_signal_emitted_with_parameters(seat, "bot_removed", [SLOT])
	(seat.find_child("BotName", true, false) as LineEdit).text_changed.emit("RA-1")
	assert_signal_emitted_with_parameters(seat, "bot_renamed", [SLOT, "RA-1"])

func test_only_a_ready_seat_glows() -> void:
	var seat := _seat()
	seat.show_seat(BOT, false, true, true)
	seat.size = Vector2(263.0, 108.0)
	var glow := seat.glow()
	assert_true(glow.visible, "box-shadow 0 0 20px -4px once ready")
	var material := glow.material as ShaderMaterial
	assert_almost_eq(float(material.get_shader_parameter("sigma")), CssShadow.sigma(LobbySeat.READY_GLOW_BLUR), EPS)
	assert_eq(material.get_shader_parameter("box_px"), Vector2(255.0, 100.0), "inset by the -4 px spread")
	seat.show_seat(HUMAN, true, false, true)
	assert_false(seat.glow().visible)

func test_compact_cards() -> void:
	var seat := _seat(true)
	seat.show_seat(HUMAN, true, false, true)
	assert_almost_eq(seat.get_combined_minimum_size().y, LobbySeat.COMPACT_MIN_HEIGHT, EPS, "2v2 / FFA: min-height 84px")
