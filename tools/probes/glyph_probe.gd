extends SceneTree
## Probe: what TextServer hands a custom text control — the glyph dictionaries of a shaped TextLine (their keys, offsets
## and fractional advances) and the run width with and without whole-pixel spacing — so glyphs can be drawn one by one
## at fractional positions for CSS letter-spacing. Prints GLYPH_PROBE lines.

const SAMPLE := "0N35H07 APPEARANCE"
const CSS_PX := 12.5
const SPACING_EM := 0.04

func _initialize() -> void:
	var server := TextServerManager.get_primary_interface()
	var font_size := UiFont.css_size(CSS_PX)
	var face := UiFont.spaced(0.0, font_size, CSS_PX)
	var line := TextLine.new()
	line.add_string(SAMPLE, face, font_size)
	var glyphs := server.shaped_text_get_glyphs(line.get_rid())
	print("GLYPH_PROBE server=%s glyphs=%d keys=%s" % [server.get_name(), glyphs.size(),
		glyphs[0].keys() if not glyphs.is_empty() else []])
	var advances := PackedFloat32Array()
	for glyph in glyphs:
		advances.append(float(glyph["advance"]))
	print("GLYPH_PROBE first=%s" % [glyphs[0] if not glyphs.is_empty() else {}])
	print("GLYPH_PROBE advances=%s line_width=%s subpixel=%s" % [advances, line.get_size().x,
		ProjectSettings.get_setting("gui/theme/default_font_subpixel_positioning")])
	var chrome := UiFont.css_width(SAMPLE, CSS_PX, SPACING_EM)
	print("GLYPH_PROBE chrome_width=%s godot_unspaced=%s" % [chrome, line.get_size().x])
	quit()
