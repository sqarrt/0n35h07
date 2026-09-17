extends GutTest
## Human camera rules parity with web HumanController + three PointerLockControls: FOV targets and smoothing, mouse
## sensitivity and the windup slow-down, the pitch limit, the own-shot shake and the third-person offset.

const EPS := 0.0001
const DT := 1.0 / 60.0

func test_fov_targets_follow_the_web_priority() -> void:
	assert_eq(CameraModel.fov_target(true, false, true, true), 95.0, "dash beats everything (DASH_FOV)")
	assert_eq(CameraModel.fov_target(false, true, false, false), 95.0, "the ghost phase spikes like a dash")
	assert_eq(CameraModel.fov_target(false, false, true, true), 70.0, "windup narrows")
	assert_eq(CameraModel.fov_target(false, false, false, true), 87.0, "moving widens")
	assert_eq(CameraModel.fov_target(false, false, false, false), 75.0, "idle")

func test_fov_eases_towards_the_target() -> void:
	assert_almost_eq(CameraModel.fov_step(75.0, 95.0, DT), lerpf(75.0, 95.0, DT * 6.0), EPS, "lerp(fov, target, dt*6)")

func test_mouse_look_uses_pointer_lock_sensitivity() -> void:
	assert_almost_eq(CameraModel.look_delta_rad(100.0, false), 0.2, EPS, "0.002 rad per pixel")
	assert_almost_eq(CameraModel.look_delta_rad(100.0, true), 0.03, EPS, "pointerSpeed 0.15 while winding up")
	assert_almost_eq(CameraModel.clamp_pitch(2.0), PI / 2.0, EPS)
	assert_almost_eq(CameraModel.clamp_pitch(-2.0), -PI / 2.0, EPS)

func test_shake_offsets_within_web_amplitude() -> void:
	assert_eq(CameraModel.SHAKE_FRAMES, 5)
	var low := CameraModel.shake_offset(func() -> float: return 0.0)
	var high := CameraModel.shake_offset(func() -> float: return 1.0)
	assert_almost_eq(low.x, -0.02, EPS)
	assert_almost_eq(low.y, -0.02, EPS)
	assert_almost_eq(high.x, 0.02, EPS)
	assert_almost_eq(low.z, 0.0, EPS, "the web shakes only x and y")

func test_third_person_offset_follows_the_camera_axes() -> void:
	var eye := Vector3(1.0, 1.7, 2.0)
	var level := CameraModel.third_person_position(eye, Basis.IDENTITY)
	assert_almost_eq(level.x, 1.7, EPS, "0.7 to the right")
	assert_almost_eq(level.y, 3.2, EPS, "1.5 up")
	assert_almost_eq(level.z, 6.0, EPS, "4 behind (forward is -Z)")
	var turned := CameraModel.third_person_position(eye, Basis(Vector3.UP, PI / 2.0))
	assert_almost_eq(turned.x, 5.0, EPS, "facing -X: behind is +X")
	assert_almost_eq(turned.z, 1.3, EPS, "right is -Z")
