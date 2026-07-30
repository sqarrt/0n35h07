extends GutTest
## BeamWeapon state machine, with a fake raycaster (no physics server).

class FakeRaycaster:
	var result   # HitResult or null
	var calls := 0
	func _init(r = null) -> void: result = r
	func raycast(_o: Vector3, _d: Vector3, _ex: Array, _p: bool):
		calls += 1
		return result

func _ctx() -> Dictionary:
	return {"muzzle": Vector3.ZERO, "aim": Vector3(0, 0, -1),
		"hit_origin": Vector3.ZERO, "hit_dir": Vector3(0, 0, -1), "exclude_ids": []}

func _advance(w: BeamWeapon, ms: float) -> void:
	var step := 1.0 / 60.0
	var elapsed := 0.0
	while elapsed < ms / 1000.0:
		w.update(step, _ctx())
		elapsed += step

func test_windup_fires_once_after_beam_windup() -> void:
	var rc := FakeRaycaster.new(HitResult.new(7, Vector3(0, 0, -3)))
	var w := BeamWeapon.new(rc)
	w.begin_windup()
	assert_true(w.is_winding_up())
	_advance(w, CombatConst.BEAM_WINDUP_MS + 20.0)
	assert_eq(rc.calls, 1, "fired exactly once")
	assert_true(w.just_fired)
	assert_eq(w.outcome["hit_entity_id"], 7)

func test_cooldown_blocks_refire() -> void:
	var rc := FakeRaycaster.new(null)
	var w := BeamWeapon.new(rc)
	w.begin_windup(); _advance(w, CombatConst.BEAM_WINDUP_MS + 20.0)  # now in cooldown
	w.begin_windup()  # ignored during cooldown
	assert_false(w.is_winding_up(), "cannot windup during cooldown")

func test_interrupt_cancels_without_cooldown() -> void:
	var rc := FakeRaycaster.new(null)
	var w := BeamWeapon.new(rc)
	w.begin_windup()
	_advance(w, 100.0)  # < BEAM_WINDUP
	w.interrupt()
	assert_false(w.is_winding_up())
	assert_eq(w.cooldown_progress(), 1.0, "no cooldown charged -> ready")
	assert_eq(rc.calls, 0, "never fired")

func test_miss_extends_to_aim_range() -> void:
	var rc := FakeRaycaster.new(null)  # nothing hit
	var w := BeamWeapon.new(rc)
	w.begin_windup(); _advance(w, CombatConst.BEAM_WINDUP_MS + 20.0)
	assert_eq(w.outcome["hit_entity_id"], -1)
	assert_almost_eq((w.outcome["end"] as Vector3).length(), CombatConst.AIM_RANGE, 0.01)

func test_wall_hit_has_no_entity() -> void:
	var rc := FakeRaycaster.new(HitResult.new(-1, Vector3(0, 0, -5)))  # wall
	var w := BeamWeapon.new(rc)
	w.begin_windup(); _advance(w, CombatConst.BEAM_WINDUP_MS + 20.0)
	assert_eq(w.outcome["hit_entity_id"], -1)
	assert_null(w.outcome["hit_point"], "wall hit records no victim point")
