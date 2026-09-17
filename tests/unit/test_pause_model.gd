extends GutTest
## PauseModel parity with web App: a live match without the pointer lock is a pause (the match keeps running). Web also
## made RESUME wait out a cooldown because Chrome refuses a repeat requestPointerLock for a while — Godot has no such
## limit, so the port resumes at once.

func test_a_pause_is_live_without_the_lock() -> void:
	var model := PauseModel.new()
	assert_true(model.is_paused(true), "live and never locked")
	model.set_locked(true)
	assert_false(model.is_paused(true))
	model.set_locked(false)
	assert_true(model.is_paused(true))
	assert_false(model.is_paused(false), "the countdown and the result screen never pause")
