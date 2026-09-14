extends SceneTree
## Dev probe: how Godot's synthetic bold (FontVariation.variation_embolden) changes a UI-font string's width and the
## ascent, at the sizes the themed UI uses — to compensate the letter spacing against Chrome, whose bold keeps advances.
##   <godot> --headless -s tools/bold_metrics_probe.gd

const CASES := [["RESUME", 16, 0.18], ["MENU", 24, 0.2], ["DRAW", 52, 0.22]]
const LEFT := HORIZONTAL_ALIGNMENT_LEFT
const NO_WIDTH := -1.0

func _initialize() -> void:
	for case in CASES:
		var text: String = case[0]
		var size: int = case[1]
		var plain := UiFont.spaced(0.0, size)
		var bold := UiFont.spaced(0.0, size)
		bold.variation_embolden = UiFont.fake_bold_embolden(size)
		var plain_w := plain.get_string_size(text, LEFT, NO_WIDTH, size).x
		var bold_w := bold.get_string_size(text, LEFT, NO_WIDTH, size).x
		print("BOLD %s %dpx embolden=%.3f width plain=%.2f bold=%.2f per-glyph=+%.3f (strength x size/16 = %.3f) ascent %.1f -> %.1f" % [
			text, size, bold.variation_embolden, plain_w, bold_w, (bold_w - plain_w) / text.length(),
			bold.variation_embolden * size / UiFont.EMBOLDEN_UNIT_SIZE, plain.get_ascent(size), bold.get_ascent(size)])
	quit()
