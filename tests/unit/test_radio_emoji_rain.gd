extends GutTest
## RadioEmojiRain — web EmojiRain: nothing without a beat; a beat births 1–2 emoji from the mood's set just above the top
## edge of the view on the plane 3.2 ahead of the camera; they fall and vanish past the bottom; the pool stops at 36.

const EPS := 0.001
const FRAME_S := 1.0 / 60.0
const ASPECT := 16.0 / 9.0
const FOV := 45.0

var _camera: Camera3D

func _rain() -> RadioEmojiRain:
	var world := Node3D.new()
	add_child_autofree(world)
	_camera = Camera3D.new()
	_camera.fov = FOV
	world.add_child(_camera)
	var rain := RadioEmojiRain.new()
	rain.random = func() -> float: return 0.5
	world.add_child(rain)
	rain.set_mood("dark_techno")
	return rain

func _half_height() -> float:
	return RadioEmojiRain.DEPTH * tan(deg_to_rad(FOV) * 0.5)

func test_nothing_falls_without_a_beat() -> void:
	var rain := _rain()
	for i in 60:
		rain.step(FRAME_S, _camera, ASPECT, false, 0.0, 1.0)
	assert_eq(rain.active_count(), 0)

func test_a_beat_births_a_batch_at_the_top_edge() -> void:
	var rain := _rain()
	rain.step(FRAME_S, _camera, ASPECT, true, 1.0, 0.0)
	assert_eq(rain.active_count(), RadioEmojiRain.BURST_MAX, "a full-strength hit births two")
	var drop: RadioEmojiRain.Drop = rain.drops()[0]
	assert_true(RadioEmojiMoods.set_for("dark_techno").has(drop.label.text))
	assert_almost_eq(drop.label.position.y, _half_height() * RadioEmojiRain.SPAWN_TOP
		- RadioEmojiRain.FALL_MIN * (1.0 + (RadioEmojiRain.DASH_STRENGTH) * exp(-FRAME_S / RadioEmojiRain.DASH_TAU)) * FRAME_S,
		0.01, "just above the view, one dashed frame down")
	assert_almost_eq(rain.global_position.z, -RadioEmojiRain.DEPTH, EPS, "3.2 ahead of the camera")
	var soft := _rain()
	soft.step(FRAME_S, _camera, ASPECT, true, 0.1, 0.0)
	assert_eq(soft.active_count(), RadioEmojiRain.BURST_MIN)

func test_they_fall_and_vanish_past_the_bottom() -> void:
	var rain := _rain()
	rain.step(FRAME_S, _camera, ASPECT, true, 1.0, 0.0)
	var start: float = rain.drops()[0].label.position.y
	rain.step(FRAME_S, _camera, ASPECT, false, 0.0, 0.0)
	assert_lt(rain.drops()[0].label.position.y, start)
	for i in 60 * 20:
		rain.step(FRAME_S, _camera, ASPECT, false, 0.0, 0.0)
	assert_eq(rain.active_count(), 0, "gone below -half height × 1.08")

func test_the_pool_stops_at_thirty_six() -> void:
	var rain := _rain()
	for i in 40:
		rain.step(FRAME_S, _camera, ASPECT, true, 1.0, 0.0)
	assert_eq(rain.active_count(), RadioEmojiRain.MAX)
