extends SceneTree
## Probe (2026-09-15): where Godot's synthetic bold puts the extra ink — the glyph bitmap's offset from the pen and its
## size with and without `variation_embolden`, at the fake-bold strength of each size. Skia (Chrome) strokes the outline
## evenly on both sides; a left edge that stays put means Godot grows the glyph to the right only.

const SIZES := [11, 16, 24, 64]
const GLYPHS := "PLAY"

func _initialize() -> void:
	var server := TextServerManager.get_primary_interface()
	for font_size in SIZES:
		var embolden := UiFont.fake_bold_embolden(font_size)
		for bold in [false, true]:
			var variation := UiFont.spaced(0.0, font_size)
			variation.variation_embolden = embolden if bold else 0.0
			var line := TextLine.new()
			line.add_string(GLYPHS, variation, font_size)
			var cells := []
			for glyph in server.shaped_text_get_glyphs(line.get_rid()):
				var rid: RID = glyph["font_rid"]
				var key := Vector2i(font_size, 0)
				var offset := server.font_get_glyph_offset(rid, key, glyph["index"])
				var extent := server.font_get_glyph_size(rid, key, glyph["index"])
				cells.append("x %.2f..%.2f adv %.2f" % [offset.x, offset.x + extent.x, glyph["advance"]])
			print("size %d embolden %.3f bold %s: %s" % [font_size, embolden, bold, cells])
	quit()
