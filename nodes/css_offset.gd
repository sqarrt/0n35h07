class_name CssOffset
## Chrome paints a fractional box from a whole pixel but keeps its text at the fractional CSS place: a CssButton or
## CssLabel placed on the snapped pixel of `css_x` learns the fraction it lost (`css_offset_x`); other boxes are left be.

const PROPERTY := &"css_offset_x"

static func keep(control: Control, css_x: float) -> void:
	if PROPERTY in control:
		control.set(PROPERTY, css_x - control.position.x)
