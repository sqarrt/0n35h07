extends GutTest
## UiButton metrics — the `.btn` defaults and an inline override like the settings language tile (web langTile:
## 0.78rem bold spaced 0.02em, 0.5rem / 0.3rem padding, no min width): 32 px high in Chrome.

func _button(button: UiButton) -> Vector2:
	add_child_autofree(button)
	return button.get_combined_minimum_size()

func test_the_btn_defaults_stay() -> void:
	var box := _button(UiButton.new("BACK", UiButton.GHOST))
	assert_eq(box.y, UiButton.BUTTON_HEIGHT)
	assert_true(box.x >= UiButton.MIN_WIDTH)

func test_an_inline_tile_override() -> void:
	var tile := UiButton.Metrics.new()
	tile.font_px = 12.48
	tile.spacing_em = 0.02
	tile.padding = Vector2(4.8, 8.0)
	tile.min_width = 0.0
	tile.always_bold = true
	var button := UiButton.new("English", UiButton.SECONDARY, false, tile)
	assert_eq(_button(button).y, 32.0, "14 px line + 8 px padding and 1 px border, twice")
	var font := button.get_theme_font("font") as FontVariation
	assert_eq(font.spacing_glyph, 0, "0.02em × 12.48 px")
	assert_gt(font.variation_embolden, 0.0, "bold on a secondary tile too")
