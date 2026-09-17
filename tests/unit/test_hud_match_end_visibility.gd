extends GutTest
## HUD parity with web GameOverlay: the in-match HUD is not shown under the match-end screen.

const PLAYER := preload("res://scenes/player.tscn")

func test_hud_hides_when_the_match_ends() -> void:
	var root := Node3D.new()
	add_child_autofree(root)
	var human: PlayerNode = PLAYER.instantiate()
	human.get_node("Camera3D").free()
	root.add_child(human)
	var match_node := MatchNode.new()
	root.add_child(match_node)
	var hud := Hud.new()
	root.add_child(hud)
	hud.setup(human, match_node)
	assert_true(hud.visible, "the HUD shows during the match")
	match_node.match_ended.emit({})
	assert_false(hud.visible, "web renders the HUD only while there is no match result")

func test_live_hud_needs_the_pointer_lock() -> void:
	var root := Node3D.new()
	add_child_autofree(root)
	var human: PlayerNode = PLAYER.instantiate()
	human.get_node("Camera3D").free()
	root.add_child(human)
	var match_node := MatchNode.new()
	root.add_child(match_node)
	var hud := Hud.new()
	root.add_child(hud)
	var lock = preload("res://tests/support/locked_pointer.gd").new()
	lock.release()
	hud.setup(human, match_node, lock)
	match_node.force_live()
	hud._process(0.0)
	var crosshair := hud.find_children("*", "HudCrosshair", true, false)[0] as CanvasItem
	var top_bar := hud.find_children("*", "HudTopBar", true, false)[0] as CanvasItem
	assert_false(crosshair.visible, "web GameOverlay: live = locked && phase live — nothing under the pause menu")
	assert_false(top_bar.visible)
	lock.lock()
	hud._process(0.0)
	assert_true(crosshair.visible, "back with the lock")
