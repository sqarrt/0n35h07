extends GutTest
## BotController state machine with real Players + a fake LOS raycaster (no physics server).

class FakeRC:
	var result   # HitResult or null
	func raycast(_o, _d, _e, _p): return result

func _armed(id: int) -> Player:
	var p := Player.new()
	p.id = id
	p.set_weapon(BeamWeapon.new(FakeRC.new()))
	p.set_shield(Shield.new())
	return p

func _bot(bot_player: Player, target, rc) -> BotController:
	return BotController.new(bot_player, func(): return target, rc,
		false, BotPersonality.from_name("Tester"))

func test_no_target_does_not_fire() -> void:
	var bp := _armed(1)
	var b := _bot(bp, null, FakeRC.new())
	for i in range(60):
		b.update(1.0 / 60.0)
	assert_false(bp.is_winding_up(), "no target -> wander, no firing")

func test_chase_moves_toward_far_target() -> void:
	var bp := _armed(1)
	bp.body.position = Vector3.ZERO
	var target := _armed(0)
	target.body.position = Vector3(0, 0, -20)   # dist 20 > BOT_CHASE_DIST
	var rc := FakeRC.new()
	rc.result = HitResult.new(0, target.body.position)   # LOS to target id 0
	var b := _bot(bp, target, rc)
	b.update(1.0 / 60.0)
	assert_lt(bp.body._wish_vel.z, 0.0, "CHASE drives movement toward the target (-Z)")

func test_fires_within_interval_with_los() -> void:
	var bp := _armed(1)
	var target := _armed(0)
	target.body.position = Vector3(0, 0, -20)
	var rc := FakeRC.new()
	rc.result = HitResult.new(0, target.body.position)
	var b := _bot(bp, target, rc)
	var fired := false
	for i in range(240):   # up to 4s > any fire interval
		b.update(1.0 / 60.0)
		if bp.is_winding_up():
			fired = true
			break
	assert_true(fired, "bot starts firing within its fire interval")

func test_cancels_windup_on_los_loss() -> void:
	var bp := _armed(1)
	var target := _armed(0)
	target.body.position = Vector3(0, 0, -20)
	var rc := FakeRC.new()
	rc.result = HitResult.new(0, target.body.position)
	var b := _bot(bp, target, rc)
	for i in range(240):
		b.update(1.0 / 60.0)
		if bp.is_winding_up():
			break
	assert_true(bp.is_winding_up(), "precondition: winding up")
	rc.result = null   # lose line of sight
	b.update(1.0 / 60.0)
	assert_false(bp.is_winding_up(), "windup cancelled when LOS is lost")
