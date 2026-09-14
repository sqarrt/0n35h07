extends GutTest
## Fallback glyphs in the UI font — Chrome spaces and emboldens every glyph of the family, the Cyrillic and CJK faces
## included; a FontVariation left without its own fallbacks would draw them from the plain base fallbacks.

func test_spaced_and_bold_faces_mirror_their_fallbacks() -> void:
	var bold := UiFont.bold_spaced(0.2, 24)
	assert_eq(bold.fallbacks.size(), UiFont.base().fallbacks.size(), "one variation per base fallback")
	for fallback in bold.fallbacks:
		var mirrored := fallback as FontVariation
		assert_not_null(mirrored)
		assert_eq(mirrored.spacing_glyph, bold.spacing_glyph, "letter spacing on Cyrillic glyphs too")
		assert_eq(mirrored.variation_embolden, bold.variation_embolden, "synthetic bold on Cyrillic glyphs too")

func test_the_cjk_face_mirrors_both_fallbacks() -> void:
	var tile := UiFont.bold_spaced(0.02, 12, 12.48, UiFont.base_cjk())
	assert_eq(tile.fallbacks.size(), UiFont.CJK_FALLBACK_COUNT, "Cyrillic and the system CJK faces")
	assert_true((tile.fallbacks[tile.fallbacks.size() - 1] as FontVariation).base_font is SystemFont)
