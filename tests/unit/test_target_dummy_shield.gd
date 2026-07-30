extends GutTest

const DUMMY := preload("res://scenes/target_dummy.tscn")

func test_raise_shield_makes_it_shielded_and_blocks() -> void:
	var d: TargetDummy = DUMMY.instantiate()
	add_child_autofree(d)
	await get_tree().process_frame
	assert_false(d.is_shielded(), "not shielded initially")
	d.raise_shield()
	assert_true(d.is_shielded())
	assert_false(d.is_blocking(), "no block pulse yet")
	d.on_block()
	assert_true(d.is_blocking(), "block pulse after on_block")
