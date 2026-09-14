extends GutTest
## The lobby's blurred map against web MapBackground / theme.css .map-bg: the preview covering 1280×720, blur 5 px and
## brightness 0.7, the 0.7 s ease fade with the lobby, the 320 ms crossfade on a map switch, and the main menu showing
## it only in the lobby.

const SCREEN := Vector2i(1280, 720)
const EPS := 0.001
const HALF := 0.5

func _background() -> MapBackground:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var background := MapBackground.new()
	viewport.add_child(background)
	return background

func test_the_preview_covers_the_screen() -> void:
	var background := _background()
	background.show_map("os_arena")
	assert_eq(background.cover_rect(), Rect2(0.0, -40.0, 1280.0, 800.0), "1024×640 scaled 1.25, centred")
	var picture := background.find_child("Picture", true, false) as ColorRect
	assert_almost_eq(float((picture.material as ShaderMaterial).get_shader_parameter("sigma")), 5.0, EPS, "blur(5px)")
	assert_almost_eq(picture.modulate.r, 0.7, EPS, "brightness(0.7)")

func test_it_fades_with_the_lobby() -> void:
	var background := _background()
	background.show_map("os_arena")
	assert_false(background.visible, "hidden outside the lobby")
	background.set_shown(true)
	background.advance(MapBackground.FADE_S * HALF)
	assert_almost_eq(background.opacity(), CssTiming.cubic_bezier(HALF, CssTiming.EASE), EPS, "opacity 0.7s ease")
	background.advance(MapBackground.FADE_S * HALF)
	assert_eq(background.opacity(), 1.0)
	background.set_shown(false)
	background.advance(MapBackground.FADE_S)
	assert_eq(background.opacity(), 0.0)
	assert_false(background.visible)

func test_a_new_map_crossfades_over_the_old() -> void:
	var background := _background()
	background.show_map("os_arena")
	background.set_shown(true)
	background.advance(MapBackground.FADE_S)
	background.show_map("os_india")
	assert_eq(background.current_map(), "os_india")
	assert_eq(background.fading_map(), "os_arena", "a snapshot of the old map over the new one")
	background.advance(MapBackground.SWITCH_FADE_S * HALF)
	assert_almost_eq(background.fading_opacity(), 1.0 - CssTiming.cubic_bezier(HALF, CssTiming.EASE), EPS)
	background.advance(MapBackground.SWITCH_FADE_S * HALF)
	assert_eq(background.fading_map(), "", "gone after 320 ms")
	for round_trip in ["os_arena", "os_india"]:   # every switch reuses the layer that faded out last time
		background.show_map(round_trip)
		background.advance(MapBackground.SWITCH_FADE_S)
		var shown := background.get_children().filter(func(layer: Node) -> bool: return (layer as Control).visible)
		assert_eq(shown.size(), 1, "one picture left on screen")
		assert_eq((shown[0] as MapBackground.Layer).map_id, round_trip)

func test_the_menu_shows_the_room_map_in_the_lobby() -> void:
	var seen: bool = Game.warning_seen
	Game.warning_seen = true
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var menu := (load("res://scenes/main_menu.tscn") as PackedScene).instantiate() as MainMenu
	viewport.add_child(menu)
	var background := menu.find_child("MapBackground", true, false) as MapBackground
	assert_not_null(background)
	assert_lt(background.get_index(), menu.backdrop().get_index(), "behind the 3D backdrop's spheres")
	menu.open_lobby()
	assert_eq(background.current_map(), MapCatalog.MAP_IDS[0], "web draftSel.map[0]")
	background.advance(MapBackground.FADE_S)
	assert_eq(background.opacity(), 1.0)
	menu.close_lobby()
	background.advance(MapBackground.FADE_S)
	assert_false(background.visible)
	Game.warning_seen = seen
