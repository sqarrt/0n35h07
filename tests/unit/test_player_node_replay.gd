extends GutTest
## A replayed PlayerNode (web DemoScene: applyNetState + setReplayPose + cosmeticFire): no simulation moves it, the
## shield bubble and the shot's deflate follow what it was told, and a recorded shot draws its beam.

const PLAYER := preload("res://scenes/player.tscn")
const TICK := 1.0 / 60.0
const PLACE := Vector3(1.0, 5.0, 1.0)
const PAST_REBIRTH_S := 1.0                    # longer than any respawn style's rebirth window

func _node() -> PlayerNode:
	var world := Node3D.new()
	add_child_autofree(world)
	var node := PLAYER.instantiate() as PlayerNode
	node.replay = true
	world.add_child(node)
	node.apply_appearance({"color": "#44ffff", "kind": Roster.KIND_HUMAN, "shieldStyle": ShieldSkinState.DOME})
	return node

func _tell(node: PlayerNode, extra := {}) -> void:
	var snap := {"id": 0, "pos": [PLACE.x, PLACE.y, PLACE.z], "aim": [0.0, 0.0, -1.0], "alive": true,
		"respawning": false, "shield": false, "dashing": false, "windup": 0.0}
	snap.merge(extra, true)
	NetProtocol.apply_player_snapshot(node.player, snap)

func test_no_simulation_moves_a_replayed_player() -> void:
	var node := _node()
	node.place_at(PLACE)
	for i in 10:
		node._physics_process(TICK)
	assert_eq(node.global_position, PLACE, "no gravity, no controller")

func test_the_shield_bubble_follows_what_it_was_told() -> void:
	var node := _node()
	node._process(PAST_REBIRTH_S)   # web: no bubble in the rebirth window right after the player appears
	_tell(node, {"shield": true})
	node._physics_process(TICK)
	assert_true(node.shield_fx().is_dome_visible())
	_tell(node, {"shield": false})
	node._physics_process(TICK)
	assert_false(node.shield_fx().is_dome_visible())

func test_a_collapsing_windup_marks_the_shot() -> void:
	var node := _node()
	_tell(node, {"windup": 0.9})
	node._physics_process(TICK)
	assert_eq(node.fire_ms(), -INF, "still charging")
	_tell(node, {"windup": 0.0})
	node._physics_process(TICK)
	assert_ne(node.fire_ms(), -INF, "web netFireTime: the deflate starts")

func test_a_recorded_shot_draws_its_beam() -> void:
	var node := _node()
	node.place_at(PLACE)
	node.play_remote_beam(PLACE + Vector3(0.0, 0.0, -10.0), PLACE + Vector3(0.0, 0.0, -9.0))
	assert_true(node.get_node("BeamFx").is_beam_visible())
