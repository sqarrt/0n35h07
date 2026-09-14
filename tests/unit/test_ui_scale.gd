extends GutTest
## UiScale: the desktop WebView's device pixel ratio — the Windows scale, DPI / 96 — and the physical sizes of render
## targets drawn under a content scale.

const EPS := 0.001
const SUBVIEWPORT_SIZE := Vector2i(64, 64)

func test_the_windows_scale_from_the_dpi() -> void:
	for case in [[96, 1.0], [120, 1.25], [144, 1.5], [192, 2.0], [72, 1.0]]:
		assert_almost_eq(UiScale.for_dpi(case[0]), case[1], EPS, "%d dpi" % case[0])

func test_inside_a_subviewport_the_scale_is_one() -> void:
	var viewport := SubViewport.new()
	viewport.size = SUBVIEWPORT_SIZE
	add_child_autofree(viewport)
	var control := Control.new()
	viewport.add_child(control)
	assert_almost_eq(UiScale.of(control), 1.0, EPS)

func test_an_item_outside_the_tree_draws_at_one() -> void:
	var control := Control.new()
	autofree(control)
	assert_almost_eq(UiScale.of(control), 1.0, EPS, "no viewport yet: laid out before it enters the tree")

func test_device_sizes_round_up_and_never_vanish() -> void:
	assert_eq(UiScale.device_size(Vector2(853.4, 480.0), 1.5), Vector2i(1281, 720))
	assert_eq(UiScale.device_size(Vector2(1280.0, 720.0), 1.0), Vector2i(1280, 720))
	assert_eq(UiScale.device_size(Vector2.ZERO, 1.5), Vector2i.ONE)
