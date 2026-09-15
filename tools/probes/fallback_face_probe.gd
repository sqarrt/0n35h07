extends SceneTree
## Probe (2026-09-15): which system face Godot draws the Radio player's symbols with through UiFont.base_with, at what
## advance, and the OS/2 line metrics SystemFontMetrics reads for those families (Chrome: ◉ ⟳ from Cambria Math,
## 💾 🔊 from Segoe UI Emoji, ← from Microsoft YaHei, ⬤ ⏮ from Segoe UI Symbol).
##   Godot.exe --headless --path . -s tools/probes/fallback_face_probe.gd

const FONT_SIZE := 12
const CASES := [
	[["Cambria Math"], "◉"], [["Cambria Math", "Segoe UI Emoji"], "⟳ 💾"], [["Segoe UI Emoji"], "🔊"],
	[["Microsoft YaHei"], "←"], [["Segoe UI Symbol"], "⬤"],
]

func _initialize() -> void:
	var server := TextServerManager.get_primary_interface()
	for entry in CASES:
		var families: Array = entry[0]
		var line := TextLine.new()
		line.add_string(entry[1], UiFont.base_with(families), FONT_SIZE)
		var faces := []
		for glyph in server.shaped_text_get_glyphs(line.get_rid()):
			faces.append("%s %s adv %.2f" % [server.font_get_name(glyph["font_rid"]),
				server.font_get_style_name(glyph["font_rid"]), glyph["advance"]])
		print("fallback probe: %s %s -> %s" % [families, entry[1], faces])
		for family in families:
			print("fallback probe:   %s path %s metrics %s" % [family, OS.get_system_font_path(family),
				SystemFontMetrics.line_em(family)])
	quit()
