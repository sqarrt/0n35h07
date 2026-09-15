extends GutTest
## RadioCameraPunch — web RadioCameraMod: a beat sets the zoom target by strength, the zoom rises fast and deflates slowly,
## a second beat re-arms rather than adds, the shake dies quickly, the move runs along the view.

const EPS := 0.0005
const FRAME_S := 1.0 / 60.0
const FORWARD := Vector3(0.0, 0.0, -1.0)

func _still(_unused := 0) -> float:
	return 0.5

func test_a_beat_sets_the_target_and_the_zoom_chases_it() -> void:
	var punch := RadioCameraPunch.new()
	punch.step(FRAME_S, true, 1.0)
	var armed := RadioCameraPunch.PUNCH_BASE + RadioCameraPunch.PUNCH_STRENGTH
	assert_almost_eq(punch.target(), armed * exp(-FRAME_S / RadioCameraPunch.DECAY_TAU), EPS, "set, then this frame's deflation")
	assert_gt(punch.punch, 0.0)
	var peak := 0.0
	for i in 20:
		punch.step(FRAME_S, false, 0.0)
		peak = maxf(peak, punch.punch)
	assert_between(peak, 0.15, armed, "a fast rise below the armed target")
	for i in 120:
		punch.step(FRAME_S, false, 0.0)
	assert_lt(punch.punch, 0.01, "deflated")

func test_beats_re_arm_instead_of_adding() -> void:
	var punch := RadioCameraPunch.new()
	for i in 30:
		punch.step(FRAME_S, true, 1.0)
	assert_lte(punch.target(), RadioCameraPunch.PUNCH_BASE + RadioCameraPunch.PUNCH_STRENGTH + EPS)

func test_the_shake_dies_and_the_move_runs_along_the_view() -> void:
	var punch := RadioCameraPunch.new()
	punch.step(FRAME_S, true, 1.0)
	assert_gt(punch.shake, 0.0)
	var move := punch.offset(FORWARD, _still)
	assert_almost_eq(move.z, -punch.punch, EPS, "a centred random: no jitter")
	for i in 60:
		punch.step(FRAME_S, false, 0.0)
	assert_lt(punch.shake, 0.0001)
