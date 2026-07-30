extends GutTest

func _p() -> Player:
	var p := Player.new()
	p.set_shield(Shield.new())
	return p

func test_activate_raises_shield() -> void:
	var p := _p()
	p.activate_shield()
	assert_true(p.is_shielded())
	assert_true(p.is_perfect_block())

func test_frozen_blocks_shield() -> void:
	var p := _p()
	p.set_frozen(true)
	p.activate_shield()
	assert_false(p.is_shielded())

func test_update_shield_expires() -> void:
	var p := _p()
	p.activate_shield()
	var e := 0.0
	while e < (CombatConst.SHIELD_DURATION_MS + 20.0) / 1000.0:
		p.update_shield(1.0 / 60.0); e += 1.0 / 60.0
	assert_false(p.is_shielded())
