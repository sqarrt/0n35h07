extends GutTest
## ENDED phase parity with web Match: the match ends only from live, once; ended is not live (players freeze).

const ONE_SECOND := 1.0

func test_end_is_ignored_before_live() -> void:
	var ph := MatchPhase.new()
	ph.end()
	assert_false(ph.is_ended(), "the countdown cannot end the match")

func test_end_from_live_is_final() -> void:
	var ph := MatchPhase.new()
	ph.force_live()
	ph.end()
	assert_true(ph.is_ended())
	assert_false(ph.is_live(), "ended freezes players like every non-live phase")
	assert_eq(ph.countdown_label(), "", "no countdown number after the end")

func test_update_does_not_leave_ended() -> void:
	var ph := MatchPhase.new()
	ph.force_live()
	ph.end()
	ph.update(ONE_SECOND)
	assert_true(ph.is_ended())
