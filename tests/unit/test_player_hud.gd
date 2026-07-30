extends GutTest

func test_ready_progress_defaults() -> void:
	var p := Player.new()
	p.set_weapon(BeamWeapon.new(null))
	p.set_shield(Shield.new())
	assert_eq(p.beam_progress(), 1.0, "beam ready by default")
	assert_eq(p.shield_progress(), 1.0, "shield ready by default")
	assert_eq(p.dash_progress(), 1.0, "dash ready by default")
	assert_eq(p.speed(), 0.0, "still by default")

func test_dash_lowers_dash_progress() -> void:
	var p := Player.new()
	p.body.dash(Vector3(1, 0, 0))
	assert_lt(p.dash_progress(), 1.0, "dash on cooldown after dashing")
