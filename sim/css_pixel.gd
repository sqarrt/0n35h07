class_name CssPixel
## Chrome composites fractional layout boxes on whole device pixels, a half going down (or right) the page: a canvas at
## y 138.5 paints from 139, a text baseline at 201.75 sits on 202.

const HALF := 0.5

static func snap(value: float) -> float:
	return floorf(value + HALF)
