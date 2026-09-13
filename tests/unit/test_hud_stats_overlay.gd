extends GutTest
## HUD stats overlay parity with web StatsOverlay: the parts each profile flag shows, the corner layout (text line box,
## 3 px gaps, the 150 x 46 graph) and the FPS text following the frames.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const FRAME_MS := 16.0
const WINDOW_FRAMES := 32

func _overlay() -> HudStatsOverlay:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var overlay := HudStatsOverlay.new()
	viewport.add_child(overlay)
	return overlay

func test_flags_pick_the_parts() -> void:
	var overlay := _overlay()
	overlay.set_flags(false, true)
	assert_false(overlay.fps_text().visible)
	assert_false(overlay.graph().visible)
	assert_true(overlay.speed_text().visible)
	overlay.set_flags(true, false)
	assert_true(overlay.fps_text().visible)
	assert_true(overlay.graph().visible)
	assert_false(overlay.speed_text().visible)

func test_corner_layout_follows_the_web_boxes() -> void:
	var overlay := _overlay()
	overlay.set_flags(true, true)
	overlay.set_speed(7.4)
	var line_box := HudStatsOverlay.FONT_SIZE * HudStatsOverlay.LINE_HEIGHT
	assert_almost_eq(overlay.fps_text().position.x, HudStatsOverlay.LEFT, EPS)
	assert_almost_eq(overlay.graph().position.y, HudStatsOverlay.TOP + line_box + HudStatsOverlay.GAP_PX, EPS,
		"the graph 3 px under the FPS line box")
	assert_almost_eq(overlay.graph().size.x, StatsModel.GRAPH_W, EPS)
	var speed_box_top := overlay.graph().position.y + StatsModel.GRAPH_H + HudStatsOverlay.GAP_PX
	assert_almost_eq(overlay.speed_text().position.y + overlay.speed_text().size.y * 0.5, speed_box_top + line_box * 0.5,
		EPS, "the speed text centred in its line box")

func test_fps_text_follows_the_frames() -> void:
	var overlay := _overlay()
	overlay.set_flags(true, false)
	for i in WINDOW_FRAMES:
		overlay.tick(FRAME_MS)
	assert_eq(overlay.fps_text().label().text, "63 FPS · MIN 63 (16.0 ms)")

func test_a_fixture_freezes_the_readings() -> void:
	var overlay := _overlay()
	overlay.set_flags(true, true)
	overlay.show_fixture(144, 9.7, PackedFloat32Array([6.9, 22.0]), 7.4)
	overlay.tick(40.0)
	overlay.set_speed(1.0)
	assert_eq(overlay.fps_text().label().text, "144 FPS · MIN 103 (9.7 ms)", "live frames no longer count")
	assert_eq(overlay.speed_text().label().text, "7.4 u/s", "nor the live speed")
