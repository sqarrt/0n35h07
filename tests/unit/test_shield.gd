extends GutTest

func _advance(s: Shield, ms: float) -> void:
	var step := 1.0 / 60.0
	var e := 0.0
	while e < ms / 1000.0:
		s.update(step); e += step

func test_activate_only_from_idle_and_is_active() -> void:
	var s := Shield.new()
	s.activate()
	assert_true(s.is_active())

func test_active_then_cooldown_then_idle() -> void:
	var s := Shield.new()
	s.activate()
	_advance(s, CombatConst.SHIELD_DURATION_MS + 20.0)
	assert_false(s.is_active(), "active window ended")
	s.activate()  # ignored during cooldown
	assert_false(s.is_active(), "cannot raise during cooldown")
	_advance(s, CombatConst.SHIELD_COOLDOWN_MS + 20.0)
	s.activate()
	assert_true(s.is_active(), "raisable again after cooldown")

func test_perfect_block_window() -> void:
	var s := Shield.new()
	s.activate()
	assert_true(s.is_perfect_block(), "perfect at t=0")
	_advance(s, CombatConst.PERFECT_BLOCK_WINDOW_MS + 20.0)
	assert_false(s.is_perfect_block(), "not perfect after the window")
	assert_true(s.is_active(), "but still active")

func test_reset_cooldown_from_cooldown_goes_idle() -> void:
	var s := Shield.new()
	s.activate(); _advance(s, CombatConst.SHIELD_DURATION_MS + 20.0)  # cooldown
	s.reset_cooldown()
	s.activate()
	assert_true(s.is_active(), "cooldown reset lets it raise immediately")

func test_progress_is_one_when_idle() -> void:
	assert_eq(Shield.new().progress(), 1.0)
