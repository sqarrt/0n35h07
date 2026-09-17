extends GutTest
## Local match rules: kill / teammate / shield block / score+streak+bounty / respawn.

class FakeRC:
	var result
	func _init(r) -> void: result = r
	func raycast(_o, _d, _e, _p): return result

func _armed(id: int, team: int, hits: int) -> Player:
	var p := Player.new()
	p.id = id
	p.team = team
	p.set_weapon(BeamWeapon.new(FakeRC.new(HitResult.new(hits, Vector3(0, 1.7, -3)))))
	p.set_shield(Shield.new())
	return p

func _fire(shooter: Player) -> void:
	shooter.aim(Vector3(0, 1.7, -5), Vector3(0, 1.7, 0))
	shooter.start_firing()
	for i in range(40):
		shooter.update_weapon(1.0 / 60.0, [])
		if shooter.weapon.fire_seq > 0:
			return

func _match(a: Player, b: Player) -> MatchRules:
	var m := MatchRules.new()
	m.add_player(a)
	m.add_player(b)
	return m

func test_enemy_hit_is_a_kill_and_scores() -> void:
	var shooter := _armed(0, 0, 1)   # hits id 1
	var victim := _armed(1, 1, -1)
	var m := _match(shooter, victim)
	_fire(shooter)
	m.resolve(1.0 / 60.0)
	assert_false(victim.alive, "victim killed")
	assert_true(victim.respawning, "victim enters ghost phase")
	assert_eq(shooter.kills, 1, "shooter scores")
	assert_eq(shooter.streak, 1)
	assert_eq(victim.deaths, 1)

func test_teammate_takes_no_harm() -> void:
	var shooter := _armed(0, 0, 1)
	var mate := _armed(1, 0, -1)     # same team
	var m := _match(shooter, mate)
	_fire(shooter)
	m.resolve(1.0 / 60.0)
	assert_true(mate.alive, "teammate is not harmed")
	assert_eq(shooter.kills, 0)

func test_shield_blocks_the_kill() -> void:
	var shooter := _armed(0, 0, 1)
	var victim := _armed(1, 1, -1)
	victim.activate_shield()
	var m := _match(shooter, victim)
	_fire(shooter)
	m.resolve(1.0 / 60.0)
	assert_true(victim.alive, "shield blocks the beam")
	assert_eq(shooter.kills, 0)

func test_bounty_for_breaking_a_triple() -> void:
	var shooter := _armed(0, 0, 1)
	var victim := _armed(1, 1, -1)
	victim.streak = Streak.STREAK_TRIPLE
	var m := _match(shooter, victim)
	_fire(shooter)
	m.resolve(1.0 / 60.0)
	assert_eq(shooter.kills, 2, "breaking a triple pays a bounty of 2")

func test_ghost_respawns_after_duration() -> void:
	var shooter := _armed(0, 0, 1)
	var victim := _armed(1, 1, -1)
	var m := _match(shooter, victim)
	_fire(shooter)
	m.resolve(1.0 / 60.0)
	assert_true(victim.respawning)
	var e := 0.0
	while e < (MatchConst.RESPAWN_GHOST_MS + 40.0) / 1000.0:
		m.resolve(1.0 / 60.0); e += 1.0 / 60.0
	assert_true(victim.alive, "victim materializes after the ghost phase")
	assert_false(victim.respawning)
