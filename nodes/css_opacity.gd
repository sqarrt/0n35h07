class_name CssOpacity extends Control
## CSS opacity on one box: the content is composited as a single layer before it fades (a CanvasGroup), so a label
## stays dark over its own fill — Godot's modulate fades every draw call on its own and lets the fill show through.

var content: Control

var _group: CanvasGroup

func _init(box: Control) -> void:
	content = box
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_group = CanvasGroup.new()
	add_child(_group)
	_group.add_child(box)
	box.minimum_size_changed.connect(update_minimum_size)
	resized.connect(_fit)

func set_opacity(alpha: float) -> void:
	_group.self_modulate.a = alpha

func opacity() -> float:
	return _group.self_modulate.a

func _get_minimum_size() -> Vector2:
	return content.get_combined_minimum_size()

func _fit() -> void:
	content.position = Vector2.ZERO
	content.size = size
