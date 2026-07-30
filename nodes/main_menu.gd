extends Control
## Main menu: Play -> arena, Quit -> exit. Screens flow: menu <-> arena.

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	($Center/Box/Play as Button).pressed.connect(_on_play)
	($Center/Box/Quit as Button).pressed.connect(_on_quit)

func _on_play() -> void:
	get_tree().change_scene_to_file("res://scenes/arena_test.tscn")

func _on_quit() -> void:
	get_tree().quit()
