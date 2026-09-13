extends GutTest
## Stats readout parity with web StatsOverlay: FPS and the worst frame per 500 ms window, the oldest-to-newest history,
## the graph scale and the web text formats (JS toFixed ties round up).

const EPS := 0.001

func test_a_window_reports_fps_and_the_worst_frame() -> void:
	var stats := StatsModel.new()
	for i in 29:
		stats.push_frame(16.0)
	assert_eq(stats.fps, 0, "no reading before the first 500 ms")
	stats.push_frame(40.0)
	assert_eq(stats.fps, 60, "30 frames in 504 ms")
	assert_almost_eq(stats.worst_ms, 40.0, EPS)
	assert_eq(stats.worst_fps(), 25)
	assert_eq(stats.fps_text(), "60 FPS · MIN 25 (40.0 ms)")

func test_history_runs_oldest_to_newest() -> void:
	var stats := StatsModel.new()
	for i in StatsModel.HISTORY + 2:
		stats.push_frame(float(i))
	var history := stats.history()
	assert_almost_eq(history[0], 2.0, EPS, "the two oldest frames rolled off")
	assert_almost_eq(history[StatsModel.HISTORY - 1], float(StatsModel.HISTORY + 1), EPS)

func test_graph_scale_and_text_formats() -> void:
	assert_almost_eq(StatsModel.graph_y(0.0), StatsModel.GRAPH_H, EPS, "fast frames sit on the bottom")
	assert_almost_eq(StatsModel.graph_y(StatsModel.MS_TOP), 0.0, EPS)
	assert_almost_eq(StatsModel.graph_y(100.0), 0.0, EPS, "clamped at the top")
	assert_eq(StatsModel.speed_text(7.25), "7.3 u/s", "an exact tie rounds up like toFixed")
	assert_eq(StatsModel.to_fixed_1(0.0), "0.0")
	assert_eq(StatsModel.to_fixed_1(12.34), "12.3")
	var stats := StatsModel.new()
	var frames := PackedFloat32Array([5.0, 6.0])
	stats.set_fixed(144, 9.7, frames)
	assert_eq(stats.fps_text(), "144 FPS · MIN 103 (9.7 ms)")
	assert_almost_eq(stats.history()[1], 6.0, EPS)
