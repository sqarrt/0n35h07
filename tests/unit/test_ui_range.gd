extends GutTest
## UiRange — theme.css `.slider` alone: the 6 px track centred in the thumb-high box, the thumb inside the track's border,
## whole-percent drags and the lit thumb while dragged.

const EPS := 0.01
const WIDTH := 235.0                          # the Radio player's volume input

func _range(initial: float) -> UiRange:
	var range_input := UiRange.new(initial)
	add_child_autofree(range_input)
	range_input.size = Vector2(WIDTH, UiRange.THUMB_SIZE.y)
	return range_input

func test_the_track_is_centred_and_the_thumb_rides_inside_its_border() -> void:
	var range_input := _range(0.8)
	assert_eq(range_input.get_combined_minimum_size().y, UiRange.THUMB_SIZE.y)
	assert_eq(range_input.track_rect(), Rect2(0.0, 6.0, WIDTH, UiRange.TRACK_HEIGHT))
	var thumb := range_input.thumb_rect()
	assert_almost_eq(thumb.position.x, 1.0 + (WIDTH - 2.0 - UiRange.THUMB_SIZE.x) * 0.8, EPS)
	assert_almost_eq(thumb.position.y, 0.0, EPS, "18 px thumb centred on the track's 4 px inside")

func test_a_drag_moves_in_whole_percents_and_lights_the_thumb() -> void:
	var range_input := _range(0.0)
	watch_signals(range_input)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = Vector2(WIDTH * 0.5, UiRange.THUMB_SIZE.y * 0.5)
	range_input._gui_input(press)
	assert_signal_emitted(range_input, "value_changed")
	assert_almost_eq(range_input.value, 0.5, 0.011)
	assert_eq(range_input.value * UiRange.PERCENT_MAX, roundf(range_input.value * UiRange.PERCENT_MAX))
	assert_true(range_input.is_lit())
	var motion := InputEventMouseMotion.new()
	motion.position = Vector2(WIDTH, 0.0)
	range_input._gui_input(motion)
	assert_eq(range_input.value, 1.0, "the drag follows the mouse off the box")
	press.pressed = false
	range_input._gui_input(press)
	assert_false(range_input.is_lit())
