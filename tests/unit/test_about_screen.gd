extends GutTest
## About screen against the Chrome boxes of web screens/About (parity-capture-settings.mjs): the title, DEVELOPER with the
## name and three links 26 px apart, TRAILER with the full-width WATCH, BACK at the bottom; WATCH asks for the trailer.

const SCREEN := Vector2i(1280, 720)
const COLUMN := Rect2(341.0, 32.0, 598.0, 656.0)
const PX := 1.0

func _about() -> AboutScreen:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var about := AboutScreen.new()
	viewport.add_child(about)
	about.position = COLUMN.position
	about.size = COLUMN.size
	return about

func _rect(about: AboutScreen, node_name: String) -> Rect2:
	return (about.find_child(node_name, true, false) as Control).get_global_rect()

func _near(actual: Vector2, expected: Vector2, what: String) -> void:
	assert_true(actual.distance_to(expected) <= PX, "%s: %s vs web %s" % [what, actual, expected])

func test_boxes_follow_chrome() -> void:
	var about := _about()
	_near(_rect(about, "Title").position, Vector2(341.0, 75.0), "h2 at 75.19")
	var header := _rect(about, "DevHeader")
	_near(header.position, Vector2(341.0, 118.0), "sub-header at 118.19")
	assert_eq(header.size, Vector2(598.0, 24.0))
	_near(_rect(about, "DevName").position, Vector2(341.0, 160.0), "name at 159.78")
	for i in 3:
		_near(_rect(about, "Link%d" % i).position, Vector2(341.0, 195.0 + 26.0 * i), "link at 194.78 + 26 × %d" % i)
	_near(_rect(about, "TrailerHeader").position, Vector2(341.0, 294.0), "sub-header at 293.58")
	var watch := _rect(about, "Watch")
	_near(watch.position, Vector2(341.0, 342.0), "WATCH at 341.56")
	assert_eq(watch.size, Vector2(598.0, UiButton.BUTTON_HEIGHT))
	_near(_rect(about, "Back").position, Vector2(341.0, 638.0), "BACK at 637.61")

func test_watch_asks_for_the_trailer() -> void:
	var about := _about()
	watch_signals(about)
	(about.find_child("Watch", true, false) as UiButton).pressed.emit()
	assert_signal_emitted(about, "trailer_requested")
	assert_eq(about.links()[2].href, "mailto:sqarrt1337@gmail.com")
