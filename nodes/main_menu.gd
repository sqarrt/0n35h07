extends Control
## Main menu: pick a map, Play -> arena, Quit -> exit.

var _maps: OptionButton

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var box := $Center/Box as VBoxContainer
	_maps = OptionButton.new()
	for entry in Game.MAPS:
		_maps.add_item(entry[0])
	box.add_child(_maps)
	box.move_child(_maps, 1)   # right under the title
	($Center/Box/Play as Button).pressed.connect(_on_play)
	($Center/Box/Quit as Button).pressed.connect(_on_quit)

func _on_play() -> void:
	Game.selected_map = Game.MAPS[_maps.selected][1]
	get_tree().change_scene_to_file("res://scenes/arena_test.tscn")

func _on_quit() -> void:
	get_tree().quit()
