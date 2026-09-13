extends GutTest
## Music loop clock: requests each loop 2 s before its boundary, applies it when the boundary passes, and skips ahead
## after a stall (web WebAudioMusicEngine tick).

func test_requests_ahead_and_applies_on_the_boundary() -> void:
	var clock := MusicScheduler.new()
	assert_eq(clock.actions(0.0), [], "loop 0 is set up before playback")
	assert_eq(clock.actions(5.9), [])
	assert_eq(clock.actions(6.0), [{"t": MusicScheduler.REQUEST, "loop": 1}], "2 s before the 8 s boundary")
	assert_eq(clock.actions(7.0), [], "requested once")
	assert_eq(clock.actions(8.0), [{"t": MusicScheduler.APPLY, "loop": 1}])
	assert_eq(clock.actions(14.0), [{"t": MusicScheduler.REQUEST, "loop": 2}])
	assert_eq(clock.applied_loop(), 1)

func test_a_stall_skips_to_the_present_loop() -> void:
	var clock := MusicScheduler.new()
	clock.actions(6.0)
	assert_eq(clock.actions(30.5), [{"t": MusicScheduler.SKIP, "loop": 3}, {"t": MusicScheduler.REQUEST, "loop": 4}],
		"no replay of loops 1 and 2; the 32 s bar is already inside the lookahead")
	assert_eq(clock.requested_loop(), 4)
	assert_eq(clock.actions(30.6), [], "requested once")
	assert_eq(clock.actions(38.0), [{"t": MusicScheduler.APPLY, "loop": 4}, {"t": MusicScheduler.REQUEST, "loop": 5}])
