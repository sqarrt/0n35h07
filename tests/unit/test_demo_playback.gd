extends GutTest
## A trailer play shot (web DemoScene) on the arena recording: players and camera on the recorded frame, the HUD's clock
## from it, then the warm-up signal, the near-end lead and the end of the fragment.

const SCREEN := Vector2i(1280, 720)
const RANGE := [[160, 170]]
const STEP_S := 0.05
const STEPS := 30

func _playback() -> Array:
	var clip := DemoClip.load_clip("os_arena")
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var playback := DemoPlayback.new()
	playback.setup(clip, RANGE)
	viewport.add_child(playback)
	return [clip, playback]

func test_the_first_frame_places_players_and_camera() -> void:
	var made := _playback()
	var clip: DemoClip = made[0]
	var playback: DemoPlayback = made[1]
	var frame: Dictionary = clip.frames[RANGE[0][0]]
	assert_true(playback.camera().global_position.is_equal_approx(DemoClip.camera(frame)["position"]))
	var bot := playback.player_node(1)
	assert_true(bot.global_position.is_equal_approx(DemoClip.position(frame["players"][1])))
	assert_true(bot.replay, "no simulation")
	assert_false(playback.player_node(0).is_body_visible(), "first person: the own sphere hidden")
	assert_eq(playback.match_node().seconds_left(), DemoClip.seconds_left(frame))

func test_it_warms_up_plays_and_ends() -> void:
	var playback: DemoPlayback = _playback()[1]
	watch_signals(playback)
	for i in STEPS:
		playback._process(STEP_S)
	assert_signal_emitted(playback, "ready_to_show")
	assert_signal_emitted(playback, "near_end")
	assert_signal_emitted(playback, "ended")
