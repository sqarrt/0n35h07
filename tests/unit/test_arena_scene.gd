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

const ARENA_MAP := "res://maps/os_arena.json"
const SPAWN_TOLERANCE := Vector2(0.01, 0.01)

func test_players_start_on_the_map_spawn_points() -> void:
	var previous: String = Game.selected_map
	Game.selected_map = ARENA_MAP
	var root: Node = load("res://scenes/arena_test.tscn").instantiate()
	add_child_autofree(root)
	Game.selected_map = previous
	var spawns: Array = Spawns.from_raw(MapFiles.read_json(ARENA_MAP))
	var by_id := {}
	for n in root.find_children("*", "", true, false):
		if n is PlayerNode:
			by_id[n.player.id] = n
	assert_eq(by_id.size(), 2, "human and bot")
	for id in by_id:
		var pos: Vector3 = by_id[id].global_position
		var spawn: Vector3 = spawns[0 if id == 0 else 1]
		assert_almost_eq(Vector2(pos.x, pos.z), Vector2(spawn.x, spawn.z), SPAWN_TOLERANCE, "player %d starts on its map spawn" % id)

func test_arena_has_no_leftover_target_dummy() -> void:
	var root: Node = load("res://scenes/arena_test.tscn").instantiate()
	add_child_autofree(root)
	assert_null(root.find_child("TargetDummy", true, false), "the match scene holds no test target (web parity)")
