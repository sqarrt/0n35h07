extends GutTest
## Map tile parity with web .lobby-maptiles .map-tile: the 194 x 207 card around the square preview and the 9 px id,
## and the selected look.

const EPS := 0.01
const SCREEN := Vector2i(1280, 720)
const TILE_WIDTH := 194.0                     # (598 - 2 x 8) / 3

func _tile() -> MapTile:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var tile := MapTile.new("os_arena")
	viewport.add_child(tile)
	tile.size = Vector2(TILE_WIDTH, 0.0)
	return tile

func test_box_preview_and_label() -> void:
	var tile := _tile()
	await wait_process_frames(2)
	tile.size = Vector2(TILE_WIDTH, tile.get_combined_minimum_size().y)
	assert_almost_eq(tile.size.y, 207.0, EPS, "1 + 6 + 180 + 5 + 10 + 4 + 1")
	assert_eq(tile.preview().position, Vector2(7.0, 7.0))
	assert_eq(tile.preview().size, Vector2(180.0, 180.0), "a square contained preview")
	assert_not_null(tile.preview().texture, "the web preview.png")
	assert_eq(tile.label().text, "os_arena")

func test_selected_look() -> void:
	var tile := _tile()
	assert_eq(tile.label().get_theme_color("font_color"), UiTokens.MUTED)
	tile.set_on(true)
	assert_true(tile.is_on())
	assert_eq(tile.label().get_theme_color("font_color"), UiTokens.ACCENT, "map-tile--on label")
