extends GutTest
## RadioScrub — the expanded player's scrub row against Chrome's boxes (window capture: the row 266×18, the grab area 190
## px from x 38, the time labels "0:04" / "2:17"): the labels' 30 px minimum, the knob on the play position, a drag that
## seeks on release.

const EPS := 0.01
const ROW := Vector2(266.0, 18.0)

func _scrub() -> RadioScrub:
	var scrub := RadioScrub.new()
	add_child_autofree(scrub)
	scrub.size = ROW
	return scrub

func test_the_rail_sits_between_two_thirty_pixel_times() -> void:
	var scrub := _scrub()
	scrub.show_progress(4000.0 / 137000.0, 137000.0)
	assert_eq(scrub.times(), ["0:04", "2:17"])
	assert_eq(scrub.rail_box(), Rect2(38.0, 0.0, 190.0, 18.0), "web radio-scrub [545, 484, 190, 18] in a row at 507")
	assert_eq(scrub.get_combined_minimum_size().y, RadioScrub.HEIGHT)

func test_a_drag_moves_the_knob_and_seeks_on_release() -> void:
	var scrub := _scrub()
	scrub.show_progress(0.1, 100000.0)
	watch_signals(scrub)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = Vector2(38.0 + 95.0, 9.0)
	scrub._gui_input(press)
	assert_almost_eq(scrub.shown_fraction(), 0.5, EPS)
	assert_eq(scrub.times()[0], "0:50", "the elapsed label follows the drag")
	assert_signal_not_emitted(scrub, "seek_requested", "web seeks on pointer up")
	press.pressed = false
	scrub._gui_input(press)
	assert_signal_emitted_with_parameters(scrub, "seek_requested", [0.5])
	assert_almost_eq(scrub.shown_fraction(), 0.5, EPS, "the bar stays where it was dropped")

func test_a_press_outside_the_rail_does_nothing() -> void:
	var scrub := _scrub()
	watch_signals(scrub)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = Vector2(10.0, 9.0)
	scrub._gui_input(press)
	press.pressed = false
	scrub._gui_input(press)
	assert_signal_not_emitted(scrub, "seek_requested")
