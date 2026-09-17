extends GutTest
## MenuCameraRig's radio hide-ball pan (web MenuBackdrop CameraRig): a linear 0..1 amount over 0.7 s, frame steps
## clamped to 0.1 s, raising the look target 12 units; showing the ball comes back at the same speed.

const EPS := 0.001
const POSE := {"default": {"position": Vector3(0.0, 1.0, 5.0), "target": Vector3.ZERO}}
const STEP_S := 0.07
const LONG_STEP_S := 1.0

func test_the_pan_is_linear_and_symmetric() -> void:
	var rig := MenuCameraRig.new(POSE)
	rig.hide_ball = true
	rig.step(STEP_S)
	assert_almost_eq(rig.hide_amount(), STEP_S / MenuCameraRig.HIDE_BALL_DUR, EPS)
	rig.step(STEP_S)
	assert_almost_eq(rig.hide_amount(), 2.0 * STEP_S / MenuCameraRig.HIDE_BALL_DUR, EPS)
	rig.hide_ball = false
	rig.step(STEP_S)
	assert_almost_eq(rig.hide_amount(), STEP_S / MenuCameraRig.HIDE_BALL_DUR, EPS, "back at the same speed")

func test_a_long_frame_moves_only_the_clamped_step() -> void:
	var rig := MenuCameraRig.new(POSE)
	rig.hide_ball = true
	rig.step(LONG_STEP_S)
	assert_almost_eq(rig.hide_amount(), MenuCameraRig.MAX_DT / MenuCameraRig.HIDE_BALL_DUR, EPS)

func test_hidden_the_look_settles_twelve_units_up() -> void:
	var rig := MenuCameraRig.new(POSE)
	rig.hide_ball = true
	for i in 200:
		rig.step(MenuCameraRig.MAX_DT)
	assert_almost_eq(rig.hide_amount(), 1.0, EPS)
	assert_almost_eq(rig.look.y, MenuCameraRig.HIDE_BALL_LOOK_UP, EPS)
	assert_almost_eq(rig.position.y, 1.0, EPS, "the camera stays where it is, only the look tilts")
