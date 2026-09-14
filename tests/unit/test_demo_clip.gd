extends GutTest
## The trailer's recordings (web public/demos) and their frames turned into the port's shapes.

const EPS := 0.001

func test_the_arena_recording_loads() -> void:
	var clip := DemoClip.load_clip("os_arena")
	assert_not_null(clip)
	assert_eq(clip.map_id, "os_arena")
	assert_eq(clip.local_id, 0)
	assert_eq(clip.frames.size(), 1561)
	assert_eq(clip.roster.size(), 2)
	assert_eq(clip.roster[1]["kind"], "bot")

func test_a_frame_gives_the_camera_and_the_snapshots() -> void:
	var clip := DemoClip.load_clip("os_arena")
	var frame: Dictionary = clip.frames[160]
	var cam := DemoClip.camera(frame)
	assert_true((cam["position"] as Vector3).is_equal_approx(Vector3(-3.718, 2.344, 0.724)))
	assert_almost_eq(float(cam["fov"]), 86.945, EPS)
	var human := DemoClip.snapshot(frame["players"][0])
	assert_almost_eq(float(human["beam"]), 0.606, EPS, "the POV beam readiness")
	var bot := DemoClip.snapshot(frame["players"][1])
	var aim := Vector3(bot["aim"][0], bot["aim"][1], bot["aim"][2])
	assert_almost_eq(aim.length(), 1.0, EPS, "a recorded aim is a direction, normalised")
	assert_eq(DemoClip.seconds_left(frame), 175, "174633 ms left shows 2:55")

func test_snapshots_drive_a_player() -> void:
	var clip := DemoClip.load_clip("os_arena")
	var p := Player.new()
	NetProtocol.apply_player_snapshot(p, DemoClip.snapshot(clip.frames[160]["players"][0]))
	assert_almost_eq(p.beam_progress(), 0.606, EPS)
	assert_true(p.alive)
