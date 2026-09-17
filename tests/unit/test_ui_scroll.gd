extends GutTest
## The desktop WebView's scrollbar (Chrome draws theme.css `scrollbar-width: thin` + `scrollbar-color`, which override the
## ::-webkit-scrollbar rules): a 10 px gutter (web .lobby-body offsetWidth 626 − clientWidth 616), 12 px arrow buttons in
## the thumb colour and a 6 px round-ended thumb, all measured on the web lobby frame.

const EPS := 0.1
const ARROW_SIZE := Vector2(10, 12)
const LAST_ROW := 11
# [column, row, coverage] of the up arrow, read from Chrome's pixels over the panel background
const UP_ARROW_SAMPLES := [[5, 6, 1.0], [4, 3, 0.92], [3, 4, 0.76], [2, 5, 0.53], [3, 7, 0.27], [0, 0, 0.0], [5, 9, 0.0]]

func _bar() -> VScrollBar:
	var bar := VScrollBar.new()
	UiScroll.style(bar)
	add_child_autofree(bar)
	return bar

func test_a_ten_pixel_gutter() -> void:
	assert_eq(_bar().get_combined_minimum_size().x, UiScroll.WIDTH_PX)

func test_arrow_buttons_in_the_thumb_colour() -> void:
	var bar := _bar()
	var up := bar.get_theme_icon("decrement").get_image()
	var down := bar.get_theme_icon("increment").get_image()
	assert_eq(Vector2(up.get_size()), ARROW_SIZE)
	assert_eq(Vector2(down.get_size()), ARROW_SIZE)
	for sample in UP_ARROW_SAMPLES:
		var coverage: float = sample[2]
		assert_almost_eq(up.get_pixel(sample[0], sample[1]).a, UiScroll.THUMB.a * coverage, EPS * UiScroll.THUMB.a,
			"up arrow at %d,%d" % [sample[0], sample[1]])
		assert_almost_eq(down.get_pixel(sample[0], LAST_ROW - sample[1]).a, UiScroll.THUMB.a * coverage,
			EPS * UiScroll.THUMB.a, "the down arrow mirrors it")
	assert_eq(Color(up.get_pixel(5, 6), 1.0), Color(UiScroll.THUMB, 1.0), "the thumb colour")

func test_a_six_pixel_thumb_with_round_ends() -> void:
	var thumb := _bar().get_theme_stylebox("grabber") as StyleBoxFlat
	assert_eq(UiScroll.WIDTH_PX + thumb.expand_margin_left + thumb.expand_margin_right, UiScroll.THUMB_PX)
	assert_eq(thumb.corner_radius_top_left, UiScroll.RADIUS)
	assert_eq(thumb.bg_color, UiScroll.THUMB)
