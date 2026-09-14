class_name UnderlinedLabel extends CssLabel
## A label with CSS `text-decoration: underline`: a 1 px line in the text colour, `offset_px` (text-underline-offset)
## below the baseline — the lobby's own nick and the local player's name in the ready ritual.

const THICKNESS_PX := 1.0
const HALF := 0.5

var underline := false
var offset_px := 0.0

## The line's centre: under the run's baseline (the native text's ascent while no CSS font is set).
func underline_y() -> float:
	var baseline := text_origin().y + run().baseline() if draws_run() \
		else get_theme_font("font").get_ascent(get_theme_font_size("font_size"))
	return baseline + offset_px + THICKNESS_PX * HALF

func _draw() -> void:
	super()
	if underline:
		var y := underline_y()
		draw_line(Vector2(0.0, y), Vector2(size.x, y), get_theme_color("font_color"), THICKNESS_PX)
