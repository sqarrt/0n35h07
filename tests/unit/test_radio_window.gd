extends GutTest
## RadioWindow — the Radio screen's floating window (web RadioExplorer.css .rexp + useWindowChrome), against the PROGRAM
## panel's Chrome boxes in the window capture (the frame [18, 18, 256, 620]: the code box 1 px in and 31 px down, the
## buttons at x 165 / 195 / 225 and y 6, the title at (9, 8)): the title wrapping when "(copied)" joins it, a drag, a
## resize held at the minimum, maximize to 8 px from the screen's edges, _ and ✕ minimizing.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const GEOMETRY := Rect2(18.0, 18.0, 256.0, 620.0)
const MINIMUM := Vector2(220.0, 160.0)
const SETTLE_S := 1.0

func _window() -> RadioWindow:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var holder := Control.new()
	holder.size = Vector2(SCREEN)
	viewport.add_child(holder)
	var window := RadioWindow.new()
	holder.add_child(window)
	window.setup("Program", GEOMETRY, MINIMUM)
	return window

func test_the_frame_bar_buttons_and_content_follow_chrome() -> void:
	var window := _window()
	assert_eq(Rect2(window.position, window.size), GEOMETRY)
	assert_eq(Rect2(window.content().position, window.content().size), Rect2(1.0, 31.0, 254.0, 588.0))
	var xs := window.buttons().map(func(b: Control) -> float: return b.position.x)
	assert_eq(xs, [165.0, 195.0, 225.0])
	for button: Control in window.buttons():
		assert_eq(button.position.y, 6.0)
		assert_eq(button.size, RadioWindow.BUTTON_SIZE)
	assert_eq(window.title_lines().size(), 1)
	assert_eq(window.title_lines()[0].label().text, "PROGRAM")
	assert_eq(window.title_lines()[0].position, Vector2(9.0, 8.0))

func test_copied_wraps_the_title_by_words() -> void:
	var window := _window()
	window.set_title("Program (copied)")
	var shown := window.title_lines().filter(func(line: GlowText) -> bool: return line.visible)
	assert_eq(shown.map(func(line: GlowText) -> String: return line.label().text), ["PROGRAM", "(COPIED)"])

func test_the_bar_drags_and_the_corner_resizes_down_to_the_minimum() -> void:
	var window := _window()
	window.start_drag(RadioWindow.MOVE, Vector2(100.0, 30.0))
	window.drag_to(Vector2(150.0, 60.0))
	window.end_drag()
	assert_eq(window.position, Vector2(68.0, 48.0), "the frame tracks the mouse 1:1")
	window.start_drag(RadioWindow.RESIZE, Vector2(300.0, 600.0))
	window.drag_to(Vector2(0.0, 0.0))
	window.end_drag()
	assert_eq(window.size, MINIMUM)

func test_maximize_fills_the_screen_but_eight_pixels_and_back() -> void:
	var window := _window()
	window.toggle_maximized()
	assert_true(window.is_maximized())
	window._process(SETTLE_S)
	assert_eq(Rect2(window.position, window.size), Rect2(8.0, 8.0, 1264.0, 704.0), "web maximized [8, 8, 1264, 704]")
	window.start_drag(RadioWindow.MOVE, Vector2.ZERO)
	window.drag_to(Vector2(50.0, 50.0))
	assert_eq(window.position, Vector2(8.0, 8.0), "no drag while maximized")
	window.toggle_maximized()
	window._process(SETTLE_S)
	assert_eq(Rect2(window.position, window.size), GEOMETRY)

func test_minimize_and_close_both_ask_to_minimize() -> void:
	var window := _window()
	watch_signals(window)
	(window.buttons()[0] as Button).pressed.emit()
	(window.buttons()[2] as Button).pressed.emit()
	assert_signal_emit_count(window, "minimize_requested", 2)
