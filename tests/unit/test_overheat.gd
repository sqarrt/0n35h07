extends GutTest
## OVERHEAT parity with web overheat.ts / Player.applyOverheat / Match.applyComeback: bounty, streak modifiers, ghost
## speed, pierce for everyone in SINGULARITY mode.

const EPS := 0.001
const STEP_S := 0.01
const SHIELD_STEP_S := 0.01
const SHIELD_SLACK_MS := 20.0

class RecordingRaycaster:
	var pierce_seen = null
	func raycast(_origin: Vector3, _dir: Vector3, _exclude: Array, pierce := false):
		pierce_seen = pierce
		return null

func test_bounty_by_victim_streak() -> void:
	assert_eq(Overheat.bounty_frags(0), 1, "normal kill = 1")
	assert_eq(Overheat.bounty_frags(Streak.STREAK_TRIPLE), 2, "breaking triple = 2")
	assert_eq(Overheat.bounty_frags(Streak.STREAK_SINGULARITY), 3, "breaking singularity = 3")

func test_break_resets_cooldowns_from_triple() -> void:
	assert_false(Overheat.break_resets_cooldowns(2))
	assert_true(Overheat.break_resets_cooldowns(Streak.STREAK_TRIPLE))

func test_overheat_mods_scale_with_streak() -> void:
	assert_eq(Overheat.overheat_mods(0)["speed"], 1.0)
	assert_gt(Overheat.overheat_mods(Streak.STREAK_SINGULARITY)["speed"], 1.0)
	assert_true(Overheat.overheat_mods(Streak.STREAK_SINGULARITY)["see_through"])

func test_streak_dots_capped() -> void:
	assert_eq(Overheat.streak_dots(50), Overheat.DOT_CAP)

func _player(streak: int) -> Player:
	var p := Player.new()
	p.set_weapon(BeamWeapon.new(RecordingRaycaster.new()))
	p.set_shield(Shield.new())
	p.streak = streak
	p.apply_overheat()
	return p

func _first_step_speed(p: Player) -> float:
	p.move_intent(Vector3.RIGHT)
	p.body.step_horizontal(STEP_S)
	return p.speed()

func test_overheat_speeds_up_movement() -> void:
	var calm := _first_step_speed(_player(0))
	assert_almost_eq(_first_step_speed(_player(Streak.STREAK_TRIPLE)) / calm, 1.2, EPS, "triple: x1.2")
	assert_almost_eq(_first_step_speed(_player(Streak.STREAK_SINGULARITY)) / calm, 1.3, EPS, "singularity: x1.3")

func test_overheat_lengthens_beam_and_shield_cooldowns() -> void:
	var calm := _player(0)
	var hot := _player(Streak.STREAK_TRIPLE)
	for p in [calm, hot]:
		p.start_firing()
		p.update_weapon(CombatConst.BEAM_WINDUP_MS / 1000.0, [])
		p.update_weapon(CombatConst.BEAM_COOLDOWN_MS / 1000.0, [])
	assert_eq(calm.beam_progress(), 1.0, "a calm beam is ready again")
	assert_almost_eq(hot.beam_progress(), 1.0 - 0.3 / 1.3, EPS, "x1.3 cooldown")
	for p in [calm, hot]:
		p.activate_shield()
		for i in ceili((CombatConst.SHIELD_DURATION_MS + CombatConst.SHIELD_COOLDOWN_MS + SHIELD_SLACK_MS) / 1000.0 / SHIELD_STEP_S):
			p.update_shield(SHIELD_STEP_S)
	assert_eq(calm.shield_progress(), 1.0)
	assert_lt(hot.shield_progress(), 1.0, "the overheated shield still recharges")

func test_ghost_moves_twice_as_fast_then_eases_back() -> void:
	var calm := _first_step_speed(_player(0))
	var ghost := _player(0)
	ghost.alive = false
	ghost.respawning = true
	ghost.respawn_timer = MatchConst.RESPAWN_GHOST_MS
	assert_almost_eq(_first_step_speed(ghost) / calm, MatchConst.RESPAWN_SPEED_MULT, EPS)
	var late := _player(0)
	late.alive = false
	late.respawning = true
	late.respawn_timer = MatchConst.RESPAWN_GHOST_MS * MatchConst.RESPAWN_SPEED_RAMP * 0.5
	assert_almost_eq(_first_step_speed(late) / calm, 1.5, EPS, "halfway down the ramp")

func test_the_beam_passes_the_pierce_flag_to_the_raycast() -> void:
	var raycaster := RecordingRaycaster.new()
	var p := Player.new()
	p.set_weapon(BeamWeapon.new(raycaster))
	p.pierce_walls = true
	p.start_firing()
	p.update_weapon(CombatConst.BEAM_WINDUP_MS / 1000.0, [])
	assert_true(raycaster.pierce_seen, "web BeamWeapon.fire: world.raycast(..., pierceWalls)")

func test_a_singularity_streak_lets_everyone_pierce() -> void:
	var rules := MatchRules.new()
	var hot := _player(Streak.STREAK_SINGULARITY)
	var calm := _player(0)
	rules.add_player(hot)
	rules.add_player(calm)
	assert_true(rules.apply_comeback(), "the mode switches on")
	assert_true(calm.pierce_walls, "everyone pierces, not just the streaker")
	assert_false(rules.apply_comeback(), "no switch, no signal")
	hot.streak = 0
	assert_true(rules.apply_comeback())
	assert_false(hot.pierce_walls)
	assert_false(rules.singularity_active)
