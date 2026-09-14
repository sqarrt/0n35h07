extends GutTest
## Mode carousel parity with web ModeCarousel: the centred tile and its neighbours one tile away (scaled .86, .45
## opacity), the glowing centre name, picks of the side tiles only, the locked strip.

const EPS := 0.05
const SCREEN := Vector2i(1280, 720)
const WIDTH := 598.0

func _carousel() -> ModeCarousel:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var carousel := ModeCarousel.new()
	viewport.add_child(carousel)
	carousel.size = Vector2(WIDTH, ModeCarousel.HEIGHT)
	carousel.set_mode(GameModes.DUEL, false)
	return carousel

func test_centre_and_side_tiles() -> void:
	var carousel := _carousel()
	var tile_width := WIDTH * ModeCarousel.TILE_SHARE
	var centre := carousel.tile(GameModes.DUEL)
	assert_almost_eq(centre.size.x, tile_width, EPS, "33.34% of the strip")
	assert_almost_eq(centre.position.x, (WIDTH - tile_width) * 0.5, EPS)
	assert_almost_eq(centre.position.y, (ModeCarousel.HEIGHT - ModeCarousel.TILE_HEIGHT) * 0.5, EPS)
	assert_almost_eq(centre.modulate.a, 1.0, EPS)
	var right := carousel.tile(GameModes.BATTLE)
	assert_eq(carousel.role_of(GameModes.BATTLE), ModeCarousel.ROLE_RIGHT, "the next mode sits on the right")
	assert_almost_eq(right.position.x - centre.position.x, tile_width, EPS, "one tile away")
	assert_almost_eq(right.scale.x, ModeCarousel.SIDE_SCALE, EPS)
	assert_almost_eq(right.modulate.a, ModeCarousel.SIDE_OPACITY, EPS)
	assert_eq(carousel.role_of(GameModes.WAR), ModeCarousel.ROLE_LEFT, "cyclic: the last mode wraps to the left")

func test_only_the_centre_name_glows() -> void:
	var carousel := _carousel()
	var centre_name := carousel.tile(GameModes.DUEL).find_child("Name", false, false) as GlowText
	var side_name := carousel.tile(GameModes.WAR).find_child("Name", false, false) as GlowText
	assert_eq(centre_name.label().text, "DUEL")
	assert_eq(centre_name.layer_count(), 1)
	assert_eq(side_name.layer_count(), 0)

func test_side_picks_and_the_locked_strip() -> void:
	var carousel := _carousel()
	watch_signals(carousel)
	carousel.tile(GameModes.DUEL).pressed.emit()
	assert_signal_not_emitted(carousel, "mode_picked", "the centre tile is already the mode")
	carousel.tile(GameModes.BATTLE).pressed.emit()
	assert_signal_emitted_with_parameters(carousel, "mode_picked", [GameModes.BATTLE])
	carousel.set_enabled(false)
	assert_almost_eq(carousel.modulate.a, ModeCarousel.LOCKED_OPACITY, EPS)
