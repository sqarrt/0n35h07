extends GutTest
## A beam is blocked by a shielded target and lands on an unshielded one.

const PLAYER := preload("res://scenes/player.tscn")
const DUMMY := preload("res://scenes/target_dummy.tscn")

func _fire_at_dummy(shielded: bool) -> TargetDummy:
	var arena := Node3D.new()
	add_child_autofree(arena)
	var d: TargetDummy = DUMMY.instantiate()
	d.entity_id = 3
	d.position = Vector3(0, 0, -6)
	arena.add_child(d)
	var p: PlayerNode = PLAYER.instantiate()
	p.player.body.position = Vector3(0, MoveConst.EYE_HEIGHT, 0)
	arena.add_child(p)
	await get_tree().physics_frame
	if shielded:
		d.raise_shield()
	p.player.aim(Vector3(0, MoveConst.EYE_HEIGHT, -100), Vector3(0, MoveConst.EYE_HEIGHT, 0))
	p.player.start_firing()
	for i in range(60):
		await get_tree().physics_frame
		if p.player.weapon.has_outcome and int(p.player.weapon.outcome.get("hit_entity_id", -1)) == 3:
			break
	return d

func test_shielded_target_blocks_not_flashes() -> void:
	var d := await _fire_at_dummy(true)
	assert_true(d.is_blocking(), "shielded target shows a block")
	assert_false(d.is_flashing(), "shielded target does not flash (blocked)")

func test_unshielded_target_flashes() -> void:
	var d := await _fire_at_dummy(false)
	assert_true(d.is_flashing(), "unshielded target flashes on hit")
