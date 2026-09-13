extends GutTest
## HUD sound visualiser parity with web AudioBar: bottom-centre geometry, the line rising with the smoothed bands, the
## glow under the line, and a fresh component each time it reappears.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)

func _bar() -> HudAudioBar:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var bar := HudAudioBar.new()
	viewport.add_child(bar)
	return bar

func test_the_bar_sits_bottom_centre() -> void:
	var bar := _bar()
	assert_almost_eq(bar.bar_size().x, 1280.0 * AudioBarModel.WIDTH_SHARE, EPS, "46% of the width")
	assert_almost_eq(bar.bar_size().y, AudioBarModel.HEIGHT_PX, EPS)
	assert_almost_eq(bar.bar_origin().x, (1280.0 - 1280.0 * AudioBarModel.WIDTH_SHARE) * 0.5, EPS, "centred")
	assert_almost_eq(bar.bar_origin().y, 720.0 - 35.0 - 42.0, EPS, "35 px above the bottom")
	assert_not_null(bar.get_node("Glow"), "the drop-shadow glow")

func test_the_line_rises_with_the_bands_and_resets() -> void:
	var bar := _bar()
	var bands := PackedFloat32Array()
	bands.resize(AudioBarModel.BANDS)
	bar.tick(bands)
	var center := AudioBarModel.BANDS - 1
	var rest_y := bar.line_points()[center].y
	assert_almost_eq(rest_y, (AudioBarModel.VIEWBOX_H - 1.0) / AudioBarModel.VIEWBOX_H * AudioBarModel.HEIGHT_PX, EPS,
		"silence rests on the bottom (bar-local)")
	bands[0] = 0.5
	bar.tick(bands)
	assert_lt(bar.line_points()[center].y, rest_y, "bass lifts the middle")
	assert_eq(bar.line_points().size(), AudioBarModel.BANDS * 2 - 1)
	bar.reset()
	assert_almost_eq(bar.line_points()[center].y, rest_y, EPS, "a fresh component starts flat")
