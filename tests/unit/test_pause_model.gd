extends GutTest
## PauseModel parity with web App: a live match without the pointer lock is a pause (the match keeps running), and
## losing the lock starts the RESUME cooldown (Chrome refuses a repeat requestPointerLock for a while).

const EPS := 0.001
const LOCK_AT_MS := 1000.0
const UNLOCK_AT_MS := 2000.0

func test_a_pause_is_live_without_the_lock() -> void:
	var model := PauseModel.new()
	assert_true(model.is_paused(true), "live and never locked")
	model.set_locked(true, LOCK_AT_MS)
	assert_false(model.is_paused(true))
	model.set_locked(false, UNLOCK_AT_MS)
	assert_true(model.is_paused(true))
	assert_false(model.is_paused(false), "the countdown and the result screen never pause")

func test_losing_the_lock_starts_the_cooldown() -> void:
	var model := PauseModel.new()
	assert_true(model.can_resume(0.0), "no cooldown before the first lock")
	assert_almost_eq(model.cooldown_share(0.0), 1.0, EPS)
	model.set_locked(true, LOCK_AT_MS)
	model.set_locked(false, UNLOCK_AT_MS)
	var halfway := UNLOCK_AT_MS + PauseModel.COOLDOWN_MS * 0.5
	assert_false(model.can_resume(halfway))
	assert_almost_eq(model.cooldown_share(halfway), 0.5, EPS)
	assert_true(model.can_resume(UNLOCK_AT_MS + PauseModel.COOLDOWN_MS))
	assert_almost_eq(model.cooldown_share(UNLOCK_AT_MS + PauseModel.COOLDOWN_MS), 1.0, EPS)

func test_only_a_change_restarts_the_cooldown() -> void:
	var model := PauseModel.new()
	model.set_locked(true, LOCK_AT_MS)
	model.set_locked(false, UNLOCK_AT_MS)
	model.set_locked(false, UNLOCK_AT_MS + PauseModel.COOLDOWN_MS)
	assert_true(model.can_resume(UNLOCK_AT_MS + PauseModel.COOLDOWN_MS), "web pointerlockchange fires on a change only")
