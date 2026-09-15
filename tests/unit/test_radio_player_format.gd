extends GutTest
## RadioPlayerFormat — web tests/unit/radioPlayerScrub.test.ts: the scrub rail's pointer fraction and the m:ss time.

const LEFT := 100.0
const WIDTH := 200.0

func test_pointer_x_maps_to_a_fraction_of_the_rail() -> void:
	assert_eq(RadioPlayerFormat.fraction_from_pointer(100.0, LEFT, WIDTH), 0.0)
	assert_eq(RadioPlayerFormat.fraction_from_pointer(200.0, LEFT, WIDTH), 0.5)
	assert_eq(RadioPlayerFormat.fraction_from_pointer(300.0, LEFT, WIDTH), 1.0)

func test_outside_the_rail_clamps_and_a_zero_width_rail_gives_zero() -> void:
	assert_eq(RadioPlayerFormat.fraction_from_pointer(50.0, LEFT, WIDTH), 0.0)
	assert_eq(RadioPlayerFormat.fraction_from_pointer(400.0, LEFT, WIDTH), 1.0)
	assert_eq(RadioPlayerFormat.fraction_from_pointer(150.0, LEFT, 0.0), 0.0)

func test_milliseconds_format_as_minutes_and_padded_seconds() -> void:
	assert_eq(RadioPlayerFormat.fmt_ms(0.0), "0:00")
	assert_eq(RadioPlayerFormat.fmt_ms(5000.0), "0:05")
	assert_eq(RadioPlayerFormat.fmt_ms(65000.0), "1:05")
	assert_eq(RadioPlayerFormat.fmt_ms(600000.0), "10:00")

func test_negative_and_nan_are_zero() -> void:
	assert_eq(RadioPlayerFormat.fmt_ms(-1.0), "0:00")
	assert_eq(RadioPlayerFormat.fmt_ms(NAN), "0:00")
