extends GutTest
## The trailer finale (web FinaleScene): the fighters facing each other under bloom, both firing with their sounds, the
## beams hanging in flight as the camera pulls back, the end, and held parity frames.

const SCREEN := Vector2i(1280, 720)
const DT := 1.0 / 60.0
const EPS := 0.001
const HANG_S := 3.0                            # real seconds after the shot: 0.15 s of beam life
const HOLD_S := 5.2
const RAGE := "rage"
const SINGULARITY := "singularity"

func _scene(hold_s := -1.0) -> FinaleScene:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var scene := FinaleScene.new()
	if hold_s >= 0.0:
		scene.hold_at(hold_s)
	viewport.add_child(scene)
	return scene

func test_the_fighters_face_each_other_under_bloom() -> void:
	var scene := _scene()
	assert_eq(scene.world().get_parent(), scene.bloom().luminance_viewport(), "the scene renders before its bloom")
	assert_true(scene.world().use_hdr_2d)
	assert_eq(scene.world().size, SCREEN)
	var composite := scene.view().material as ShaderMaterial
	assert_true(composite.get_shader_parameter("lit"))
	assert_almost_eq(float(composite.get_shader_parameter("bloom_intensity")), FinaleScene.BLOOM_INTENSITY, EPS)
	assert_lt(scene.ball(0).global_position.x, 0.0)
	assert_gt(scene.ball(1).global_position.x, 0.0)
	assert_almost_eq(scene.ball(0).global_position.y, FinaleTimeline.CENTER_Y, EPS)
	assert_eq(scene.windup(0).style(), RAGE)
	assert_eq(scene.beam(1).style(), SINGULARITY)
	assert_eq(scene.camera().global_position.z, FinaleTimeline.CAM_Z0)
	assert_almost_eq(scene.camera().fov, FinaleScene.FOV, EPS)

func test_both_fire_and_the_beams_hang() -> void:
	var scene := _scene()
	var sounds := []
	scene.sound.connect(func(event: String) -> void: sounds.append(event))
	while not scene.timeline.fired:
		scene.advance(DT)
	assert_eq(sounds, [DemoPlayback.BEAM_SOUNDS[RAGE], DemoPlayback.BEAM_SOUNDS[SINGULARITY]])
	for i in FinaleScene.FIGHTERS.size():
		assert_true(scene.beam(i).is_beam_visible())
	for i in ceili(HANG_S / DT):
		scene.advance(DT)
	for i in FinaleScene.FIGHTERS.size():
		assert_true(scene.beam(i).is_beam_visible(), "time nearly stops: still in flight")
	assert_gt(scene.camera().global_position.z, FinaleTimeline.CAM_Z0, "the camera pulls back")

func test_the_finale_ends_once() -> void:
	var scene := _scene()
	watch_signals(scene)
	for i in ceili(FinaleTimeline.FINALE_DUR / DT) + 1:
		scene.advance(DT)
	assert_signal_emit_count(scene, "ended", 1)

func test_a_held_frame_steps_to_its_moment() -> void:
	var scene := _scene(HOLD_S)
	assert_almost_eq(scene.timeline.real_s, HOLD_S, DT)
	assert_true(scene.timeline.fired)
	var held := scene.timeline.real_s
	scene._process(DT)
	assert_eq(scene.timeline.real_s, held, "the clock stays put")
