extends GutTest

class FakeRaycaster:
	var result
	func _init(r = null) -> void: result = r
	func raycast(_o, _d, _ex, _p): return result

func _armed_player(rc) -> Player:
	var p := Player.new()
	p.set_weapon(BeamWeapon.new(rc))
	return p

func test_start_firing_begins_windup() -> void:
	var p := _armed_player(FakeRaycaster.new(null))
	p.start_firing()
	assert_true(p.is_winding_up())

func test_frozen_blocks_firing() -> void:
	var p := _armed_player(FakeRaycaster.new(null))
	p.set_frozen(true)
	p.start_firing()
	assert_false(p.is_winding_up())

func test_update_weapon_fires_and_hits_via_aim() -> void:
	var p := _armed_player(FakeRaycaster.new(HitResult.new(9, Vector3(0, 1.7, -3))))
	p.aim(Vector3(0, 1.7, -100), Vector3(0, 1.7, 0))
	p.start_firing()
	var elapsed := 0.0
	while elapsed < (CombatConst.BEAM_WINDUP_MS + 20.0) / 1000.0:
		p.update_weapon(1.0 / 60.0, [])
		elapsed += 1.0 / 60.0
	assert_true(p.weapon.just_fired)
	assert_eq(p.weapon.outcome["hit_entity_id"], 9)

func test_cancel_firing_interrupts() -> void:
	var p := _armed_player(FakeRaycaster.new(null))
	p.start_firing()
	p.update_weapon(0.1, [])   # 100ms < windup
	p.cancel_firing()
	assert_false(p.is_winding_up())
