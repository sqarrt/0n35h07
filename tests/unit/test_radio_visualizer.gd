extends GutTest
## RadioVisualizer — the canvas follows its box (web: the buffer is the element's CSS size), runs only while active or
## pinned, and the LIBRARY window puts it under its content, running while the radio is on and the window shows.

const BOX := Vector2(610.0, 370.0)
const PIN := {"phase": 1.7, "frame": 0, "level": 0.08, "impulse": 0.35, "seed": 7, "bands": []}

func _visualizer() -> RadioVisualizer:
	var visualizer := RadioVisualizer.new()
	add_child_autofree(visualizer)
	visualizer.size = BOX
	return visualizer

func test_the_canvas_takes_the_element_size() -> void:
	var visualizer := _visualizer()
	assert_eq(visualizer.canvas_size(), Vector2i(BOX))

func test_it_runs_only_while_active_or_pinned() -> void:
	var visualizer := _visualizer()
	assert_false(visualizer.is_running(), "off until the radio plays")
	visualizer.set_active(true)
	assert_true(visualizer.is_running())
	visualizer.set_active(false)
	assert_false(visualizer.is_running())
	visualizer.pin(PIN)
	assert_true(visualizer.is_running(), "a capture's pinned frame")
	assert_true(visualizer.state.still)

func test_the_library_window_hosts_it_under_the_content() -> void:
	var explorer := RadioExplorer.new()
	add_child_autofree(explorer)
	var visualizer := explorer.visualizer()
	assert_eq(visualizer.get_parent(), explorer.underlay())
	assert_lt(explorer.underlay().get_index(), explorer.content().get_index(), "web .rexp-vis z 0 under z 1")
	explorer.set_radio_active(true)
	assert_true(visualizer.is_running())
	explorer.visible = false
	assert_false(visualizer.is_running(), "web: hidden (minimized) stops it")
	explorer.visible = true
	assert_true(visualizer.is_running())
	explorer.set_viz_mode("bars", false)
	assert_eq(visualizer.mode, "bars")
