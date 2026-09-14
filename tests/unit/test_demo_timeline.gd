extends GutTest
## The replay clock against web DemoScene on a synthetic clip (a frame every 100 ms): the frame and the blend at the
## clock, the events due, the jump cut to the next fragment, the near-end lead and the end.

const EPS := 0.0001
const FRAME_MS := 100.0
const FRAMES := 20
const STEPS := 8

func _clip() -> DemoClip:
	var frames := []
	for i in FRAMES:
		frames.append({"tMs": i * FRAME_MS, "events": []})
	return DemoClip.from_data({"mapId": "os_arena", "localId": 0, "roster": [], "frames": frames})

func test_the_frame_and_the_blend_follow_the_clock() -> void:
	var timeline := DemoTimeline.new(_clip(), [[2, 6]])
	assert_eq(timeline.clock_ms, 200.0, "the clock starts on the fragment's first frame")
	var s := timeline.step(0.025)
	assert_eq(s["frame"], 2)
	assert_eq(s["next"], 3)
	assert_almost_eq(float(s["blend"]), 0.25, EPS)
	assert_eq(s["events"], [2], "the first frame's events fire on the first step")
	s = timeline.step(0.05)
	assert_eq(s["frame"], 2)
	assert_eq(s["events"], [], "nothing new")
	s = timeline.step(0.05)
	assert_eq(s["frame"], 3, "325 ms: past frame 3")
	assert_eq(s["events"], [3])

func test_a_long_frame_is_clamped_like_the_web() -> void:
	var timeline := DemoTimeline.new(_clip(), [[0, 10]])
	timeline.step(1.0)
	assert_almost_eq(timeline.clock_ms, DemoTimeline.MAX_STEP_S * 1000.0, EPS, "dt capped at 50 ms")

func test_fragments_cut_and_the_last_one_ends() -> void:
	var timeline := DemoTimeline.new(_clip(), [[1, 2], [10, 11]])
	var cut := false
	var near_end := false
	var ended := false
	for i in STEPS:
		var s := timeline.step(0.05)
		cut = cut or bool(s["cut"])
		near_end = near_end or bool(s["near_end"])
		ended = ended or bool(s["ended"])
	assert_true(cut, "a jump cut at the end of the first fragment")
	assert_eq(timeline.first_frame(), 10, "the second fragment")
	assert_true(near_end, "the lead signal before the last fragment ends")
	assert_true(ended)
	assert_true(timeline.ended)
