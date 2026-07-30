extends GutTest
## The playable arena instantiates and steps without errors, and the player rests on the floor.

func test_arena_loads_and_player_settles() -> void:
	var scene: PackedScene = load("res://scenes/arena_test.tscn")
	assert_not_null(scene, "arena_test.tscn loads")
	var root := scene.instantiate()
	add_child_autofree(root)
	var pnode: PlayerNode = root.find_child("Player", true, false)
	assert_not_null(pnode, "arena contains a Player")
	for i in range(120):
		await get_tree().physics_frame
	assert_lt(pnode.global_position.y, 5.0, "player has fallen/settled onto the arena floor")
