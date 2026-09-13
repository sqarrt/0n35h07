class_name PauseOverlay extends CanvasLayer
## Pause menu in the arena: `pause` (Esc) toggles it; Resume or return to the main menu.
## Owns the mouse mode + tree pause while shown (process_mode ALWAYS so it works while paused).

var enabled := true   # the match-end screen switches the pause menu off
var _dim: ColorRect
var _shown := false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 10
	_dim = ColorRect.new()
	_dim.color = Color(0, 0, 0, 0.6)
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 16)
	center.add_child(box)
	var title := Label.new()
	title.text = "PAUSED"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 48)
	box.add_child(title)
	var resume := Button.new()
	resume.text = "RESUME"
	resume.pressed.connect(_on_resume)
	box.add_child(resume)
	var menu := Button.new()
	menu.text = "MAIN MENU"
	menu.pressed.connect(_on_main_menu)
	box.add_child(menu)
	visible = false

func _unhandled_input(event: InputEvent) -> void:
	if enabled and event.is_action_pressed("pause"):
		_set_shown(not _shown)

func _set_shown(v: bool) -> void:
	_shown = v
	visible = v
	get_tree().paused = v
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if v else Input.MOUSE_MODE_CAPTURED

func _on_resume() -> void:
	_set_shown(false)

func _on_main_menu() -> void:
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
