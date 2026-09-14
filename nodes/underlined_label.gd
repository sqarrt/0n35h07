class_name UnderlinedLabel extends Label
## A label with CSS `text-decoration: underline`: a 1 px line in the text colour, `offset_px` (text-underline-offset)
## below the baseline — the lobby's own nick and the local player's name in the ready ritual.

const THICKNESS_PX := 1.0
const HALF := 0.5

var underline := false
var offset_px := 0.0

func _draw() -> void:
	if not underline:
		return
	var font := get_theme_font("font")
	var y := font.get_ascent(get_theme_font_size("font_size")) + offset_px + THICKNESS_PX * HALF
	draw_line(Vector2(0.0, y), Vector2(size.x, y), get_theme_color("font_color"), THICKNESS_PX)
