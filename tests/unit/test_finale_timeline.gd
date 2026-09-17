extends GutTest
## The trailer finale's clock (web FinaleScene useFrame): the slow charge, the shot, the near-frozen beams, the camera's
## pull-back and the end.

const DT := 1.0 / 60.0
const EPS := 0.0001
const LONG_FRAME_S := 1.0

func test_the_charge_runs_slow_then_the_shot_fires() -> void:
	var timeline := FinaleTimeline.new()
	var first := timeline.step(DT)
	assert_almost_eq(float(first["charge"]), DT * FinaleTimeline.SLOWMO_CHARGE / FinaleTimeline.CHARGE_DUR, EPS)
	var fire: Dictionary = {}
	while fire.is_empty():
		var step := timeline.step(DT)
		if step["fire"]:
			fire = step
	assert_eq(fire["charge"], 1.0, "the charge completes on the firing frame")
	assert_almost_eq(timeline.real_s, FinaleTimeline.CHARGE_DUR / FinaleTimeline.SLOWMO_CHARGE, DT, "≈ 2.86 s")
	var hold := timeline.step(DT)
	assert_eq(hold["charge"], -1.0)
	assert_false(hold["fire"], "once")
	assert_almost_eq(float(hold["beam_dt"]), DT * FinaleTimeline.SLOWMO_HOLD, EPS, "the beams nearly stop")

func test_the_camera_pulls_back_and_the_finale_ends_once() -> void:
	var timeline := FinaleTimeline.new()
	assert_eq(timeline.camera_z(), FinaleTimeline.CAM_Z0)
	var ends := 0
	while not timeline.ended:
		if timeline.step(DT)["ended"]:
			ends += 1
	assert_eq(ends, 1)
	assert_almost_eq(timeline.real_s, FinaleTimeline.FINALE_DUR, DT)
	assert_eq(timeline.camera_z(), FinaleTimeline.CAM_Z1, "pulled all the way back after 7 s")
	assert_eq(timeline.step(DT)["dt"], 0.0, "nothing moves after the end")

func test_a_long_frame_is_clamped() -> void:
	assert_eq(FinaleTimeline.new().step(LONG_FRAME_S)["dt"], FinaleTimeline.MAX_DT)
