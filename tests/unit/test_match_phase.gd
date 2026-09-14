extends GutTest
## The match phases against web Match: the ready ritual first (bots confirmed from the start), the 3 s countdown once
## every participant has confirmed, then live.

const HUMAN := 0
const BOT := 1

func _phase() -> MatchPhase:
	var ph := MatchPhase.new()
	ph.add_participant(HUMAN)
	ph.add_participant(BOT, true)   # web: bots are auto-ready
	return ph

func _run(ph: MatchPhase, seconds: float) -> void:
	var e := 0.0
	while e < seconds:
		ph.update(1.0 / 60.0)
		e += 1.0 / 60.0

func test_starts_in_the_ready_ritual() -> void:
	var ph := _phase()
	assert_true(ph.is_ready_phase(), "web phase = 'ready' for every match")
	assert_false(ph.is_live())
	assert_eq(ph.countdown_label(), "", "no number before the countdown")
	assert_eq(ph.ready_ids(), [BOT], "bots are ready from the start")
	_run(ph, (MatchConst.READY_COUNTDOWN_MS + 40.0) / 1000.0)
	assert_true(ph.is_ready_phase(), "time alone never starts the countdown")

func test_the_countdown_starts_once_everyone_is_ready() -> void:
	var ph := _phase()
	assert_true(ph.mark_ready(HUMAN), "a new confirmation")
	assert_false(ph.mark_ready(HUMAN), "already ready")
	assert_eq(ph.ready_ids(), [HUMAN, BOT])
	assert_false(ph.is_ready_phase())
	assert_eq(ph.countdown_label(), "3", "3s countdown shows 3 first")
	assert_false(ph.mark_ready(7), "not a participant")

func test_goes_live_after_countdown() -> void:
	var ph := _phase()
	ph.mark_ready(HUMAN)
	_run(ph, (MatchConst.READY_COUNTDOWN_MS + 40.0) / 1000.0)
	assert_true(ph.is_live(), "live after READY_COUNTDOWN_MS")
	assert_eq(ph.countdown_label(), "", "no countdown label when live")

func test_countdown_ticks_down() -> void:
	var ph := _phase()
	ph.mark_ready(HUMAN)
	_run(ph, 1.1)
	assert_eq(ph.countdown_label(), "2", "after ~1.1s of a 3s countdown -> 2")

func test_force_live() -> void:
	var ph := _phase()
	ph.force_live()
	assert_true(ph.is_live())
	assert_eq(ph.ready_ids(), [HUMAN, BOT], "web forceLiveForTest readies everyone")
