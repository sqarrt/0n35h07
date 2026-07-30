extends GutTest

func test_starts_in_countdown() -> void:
	var ph := MatchPhase.new()
	assert_false(ph.is_live(), "starts in countdown")
	assert_eq(ph.countdown_label(), "3", "3s countdown shows 3 first")

func test_goes_live_after_countdown() -> void:
	var ph := MatchPhase.new()
	var e := 0.0
	while e < (MatchConst.READY_COUNTDOWN_MS + 40.0) / 1000.0:
		ph.update(1.0 / 60.0); e += 1.0 / 60.0
	assert_true(ph.is_live(), "live after READY_COUNTDOWN_MS")
	assert_eq(ph.countdown_label(), "", "no countdown label when live")

func test_countdown_ticks_down() -> void:
	var ph := MatchPhase.new()
	var e := 0.0
	while e < 1.1:   # ~1.1s in
		ph.update(1.0 / 60.0); e += 1.0 / 60.0
	assert_eq(ph.countdown_label(), "2", "after ~1.1s of a 3s countdown -> 2")

func test_force_live() -> void:
	var ph := MatchPhase.new()
	ph.force_live()
	assert_true(ph.is_live())
