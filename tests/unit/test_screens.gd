extends GutTest
## The screens load and build without error (headless).

func test_main_menu_has_play_button() -> void:
	var s: PackedScene = load("res://scenes/main_menu.tscn")
	assert_not_null(s, "main_menu.tscn loads")
	var root = s.instantiate()
	add_child_autofree(root)
	await get_tree().process_frame
	assert_not_null(root.find_child("Play", true, false), "menu has a Play button")
	assert_not_null(root.find_child("Quit", true, false), "menu has a Quit button")

func test_pause_overlay_hidden_by_default() -> void:
	var p := PauseOverlay.new()
	add_child_autofree(p)
	await get_tree().process_frame
	assert_false(p.visible, "pause overlay starts hidden")
