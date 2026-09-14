class_name CssRow extends Container
## A flex row — web `display: flex; align-items: center; gap` (the HUD bars): children at their minimum size, their
## fractional widths added up with `gap` between them (BoxContainer rounds each one up), each centred down the row; a
## fixed `css_width` justifies the content to its START, END or CENTER. Boxes land on whole pixels (CssPixel), their
## text keeps the fraction (CssOffset), and the fraction this row's own box lost (`css_offset_x`) carries on to them.

const HALF := 0.5
const START := 0
const END := 1
const CENTER := 2

var gap := 0.0:
	set(value):
		gap = value
		update_minimum_size()
		queue_sort()
var justify := START:
	set(value):
		justify = value
		queue_sort()
var css_width := 0.0:                          # 0: as wide as the content
	set(value):
		css_width = value
		update_minimum_size()
		queue_sort()
var css_offset_x := 0.0:
	set(value):
		css_offset_x = value
		queue_sort()

## web `left: 50%; transform: translateX(-50%)` inside `width`: `row`'s box stays where its container put it, its
## content goes to the fractional centre.
static func centre_in(row: CssRow, width: float) -> void:
	row.css_offset_x = (width - row.content_width()) * HALF - row.position.x

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE

## The children's fractional widths and the gaps between them.
func content_width() -> float:
	var boxes := CssColumn.boxes_of(self)
	var width := gap * maxi(boxes.size() - 1, 0)
	for child in boxes:
		width += CssColumn.box_size(child).x
	return width

func _get_minimum_size() -> Vector2:
	var height := 0.0
	for child in CssColumn.boxes_of(self):
		height = maxf(height, CssColumn.box_size(child).y)
	return Vector2(maxf(css_width, content_width()), height)

func _notification(what: int) -> void:
	if what == NOTIFICATION_SORT_CHILDREN:
		_sort()

func _sort() -> void:
	var free := (css_width if css_width > 0.0 else size.x) - content_width()
	var x := css_offset_x
	match justify:
		END:
			x += free
		CENTER:
			x += free * HALF
	for child in CssColumn.boxes_of(self):
		var box := CssColumn.box_size(child)
		fit_child_in_rect(child, Rect2(CssPixel.snap(x), CssPixel.snap((size.y - box.y) * HALF), box.x, box.y))
		CssOffset.keep(child, x)
		x += box.x + gap
