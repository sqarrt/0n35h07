class_name CssColumn extends Container
## A flex column centred on both axes (web `.screen`, the MatchEndedOverlay wrap): children at their minimum size, CSS
## vertical margins that add up (flex items don't collapse them), `gap` between boxes, every box on whole pixels
## (CssPixel). Hidden children take no room, like display: none.

const HALF := 0.5

var gap := 0.0:
	set(value):
		gap = value
		update_minimum_size()
		queue_sort()

var _margins := {}   # child -> Vector2(margin top, margin bottom)

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE

## Append a child with its CSS vertical margins.
func add(child: Control, margin_top := 0.0, margin_bottom := 0.0) -> void:
	_margins[child] = Vector2(margin_top, margin_bottom)
	add_child(child)
	update_minimum_size()
	queue_sort()

func margins_of(child: Node) -> Vector2:
	return _margins.get(child, Vector2.ZERO)

func _notification(what: int) -> void:
	if what == NOTIFICATION_SORT_CHILDREN:
		_sort()

func _get_minimum_size() -> Vector2:
	var width := 0.0
	for child in _boxes():
		width = maxf(width, child.get_combined_minimum_size().x)
	return Vector2(width, _content_height())

func _boxes() -> Array[Control]:
	var boxes: Array[Control] = []
	for child in get_children():
		var control := child as Control
		if control != null and control.visible and not control.top_level:
			boxes.append(control)
	return boxes

func _content_height() -> float:
	var boxes := _boxes()
	var total := gap * maxi(boxes.size() - 1, 0)
	for child in boxes:
		var margins := margins_of(child)
		total += margins.x + child.get_combined_minimum_size().y + margins.y
	return total

func _sort() -> void:
	var y := (size.y - _content_height()) * HALF
	for child in _boxes():
		var margins := margins_of(child)
		var box := child.get_combined_minimum_size()
		y += margins.x
		fit_child_in_rect(child, Rect2(CssPixel.snap((size.x - box.x) * HALF), CssPixel.snap(y), box.x, box.y))
		y += box.y + margins.y + gap
