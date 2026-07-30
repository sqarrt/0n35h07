extends GutTest
## Firing through PlayerNode hits a dummy in front and plays the beam.

const PLAYER := preload("res://scenes/player.tscn")
const DUMMY := preload("res://scenes/target_dummy.tscn")

func test_firing_hits_dummy_and_beams() -> void:
	var arena := Node3D.new()
	add_child_autofree(arena)
	var floor_body := StaticBody3D.new()
	floor_body.collision_layer = CombatConst.LAYER_WORLD_BIT
	var fcs := CollisionShape3D.new()
	var fbox := BoxShape3D.new(); fbox.size = Vector3(40, 1, 40)
	fcs.shape = fbox; fcs.position = Vector3(0, -0.5, 0)
	floor_body.add_child(fcs)
	arena.add_child(floor_body)
	var dummy: TargetDummy = DUMMY.instantiate()
	dummy.entity_id = 3
	dummy.position = Vector3(0, 0, -6)
	arena.add_child(dummy)
	var p: PlayerNode = PLAYER.instantiate()
	p.player.body.position = Vector3(0, MoveConst.EYE_HEIGHT, 0)
	arena.add_child(p)
	await get_tree().physics_frame
	# aim straight ahead and fire; run past windup
	p.player.aim(Vector3(0, MoveConst.EYE_HEIGHT, -100), Vector3(0, MoveConst.EYE_HEIGHT, 0))
	p.player.start_firing()
	var fired := false
	for i in range(60):  # windup ~24 ticks; break the moment the shot lands (flash is fresh)
		await get_tree().physics_frame
		if p.player.weapon.has_outcome and int(p.player.weapon.outcome.get("hit_entity_id", -1)) == 3:
			fired = true
			break
	assert_true(fired, "beam hit the dummy (entity 3)")
	assert_true(dummy.is_flashing(), "dummy flashed on the registered hit")
