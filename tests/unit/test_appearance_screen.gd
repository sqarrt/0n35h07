extends GutTest
## Appearance screen against web screens/Appearance (parity-capture-appearance.mjs, desktop build): the boxes of the
## scrolling page in its 598 px column (588 beside Chrome's thin scrollbar), the colour rules (a primary equal to the
## reserve pushes the reserve on; the primary slot in the reserve row only switches the slot shown), the preview spec,
## the clicked block's part, style previews and the artwork written to the profile.

const SCREEN := Vector2i(1280, 720)
const COLUMN := Rect2(617.0, 32.0, 598.0, 656.0)   # the panel slid to 576
const PX := 1.0
const PROFILE := {"primaryColor": "#fa4", "reserveColor": "#4af", "ballModel": "smooth", "windupStyle": "classic",
	"respawnStyle": "echo", "dashStyle": "streak", "shieldStyle": "dome"}

func _screen() -> AppearanceScreen:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var screen := AppearanceScreen.new()
	screen.setup(PROFILE.duplicate())
	viewport.add_child(screen)
	screen.position = COLUMN.position
	screen.size = COLUMN.size
	return screen

func _rect(screen: AppearanceScreen, node_name: String) -> Rect2:
	return (screen.find_child(node_name, true, false) as Control).get_global_rect()

func _near(actual: Vector2, expected: Vector2, what: String) -> void:
	assert_true(actual.distance_to(expected) <= PX, "%s: %s vs web %s" % [what, actual, expected])

func test_boxes_follow_chrome() -> void:
	var screen := _screen()
	_near(_rect(screen, "Title").position, Vector2(617.0, 75.0), "h2 at 75.19")
	_near(_rect(screen, "OnModel").position, Vector2(617.0, 118.0), "ON MODEL at 118.19")
	_near(_rect(screen, "PrimaryLabel").position, Vector2(617.0, 160.0), "label at 159.98")
	_near(_rect(screen, "Primary_#f55").position, Vector2(908.0, 183.0), "last swatch at 908.16, 182.58")
	_near(_rect(screen, "Reserve_#4af").position, Vector2(617.0, 263.0), "swatch at 262.77")
	assert_almost_eq(_rect(screen, "Model_planet").position.y, 343.0, PX, "model row at 342.95")
	_near(_rect(screen, "Brush").position, Vector2(617.0, 416.0), "brush at 416.14")
	_near(_rect(screen, "PaintFront").position, Vector2(696.0, 467.0), "front field column at 695.59, 466.73")
	_near(_rect(screen, "PaintBack").position, Vector2(994.0, 467.0), "back field column at 994.39")
	_near(_rect(screen, "windupStyle_classic").position, Vector2(617.0, 695.0), "shot row at 694.7")
	_near(_rect(screen, "shieldStyle_dome").position, Vector2(617.0, 914.0), "shield row at 914.27")
	var back := _rect(screen, "Back")
	_near(back.position, Vector2(617.0, 965.0), "BACK at 964.86")
	assert_eq(back.size, Vector2(588.0, UiButton.BUTTON_HEIGHT), "beside the 10 px scrollbar")

func test_colour_rules_and_preview() -> void:
	var screen := _screen()
	watch_signals(screen)
	assert_eq(screen.preview_spec(), {"color": "#fa4", "model": "smooth", "ring": "#4af", "art": "",
		"windup": "classic", "respawn": "echo", "dash": "streak", "shield": "dome"})
	screen.choose_reserve("#fa4")
	assert_eq(screen.profile["reserveColor"], "#4af", "the primary colour cannot be the reserve")
	assert_eq(screen.editing, AppearanceScreen.SLOT_RESERVE, "but the ball now shows the reserve slot")
	assert_signal_not_emitted(screen, "profile_changed")
	assert_eq(screen.preview_spec()["color"], "#4af")
	screen.choose_primary("#4af")
	assert_eq(screen.profile["primaryColor"], "#4af")
	assert_eq(screen.profile["reserveColor"], "#fa4", "pushed to the first other palette colour")
	assert_eq(screen.part, MenuCameraRig.PART_COLOR)

func test_styles_parts_and_art() -> void:
	var screen := _screen()
	watch_signals(screen)
	screen.choose_style(AppearanceScreen.STYLE_GROUPS[0], "rage")
	assert_eq(screen.profile["windupStyle"], "rage")
	assert_eq(screen.part, MenuCameraRig.PART_SHOT)
	assert_signal_emitted_with_parameters(screen, "style_previewed", [MenuCameraRig.PART_SHOT, "rage"])
	screen.paint(BallArt.BACK, 8, 8, 1)
	assert_eq(screen.part, MenuCameraRig.PART_PAINT_BACK)
	var art := BallArt.decode(screen.profile["ballArt"])
	assert_eq((art[BallArt.BACK] as PackedByteArray)[8 * BallArt.SIZE + 8], 1)
	screen.clear_side(BallArt.BACK)
	assert_false(screen.profile.has("ballArt"), "an empty artwork leaves the profile")
