extends GutTest
## Menu backdrop parity with web MenuBackdrop: the camera on the default pose at 45°, the lights (ambient 0.4, a
## directional 1 from (10, 10, 5) aimed at the origin, both divided by π), the ball on the player's spot, held
## through the warm-up and fading in, and the camera pose following the screen.

const EPS := 0.001
const SCREEN := Vector2i(1280, 720)

func _backdrop() -> MenuBackdrop:
	var viewport := SubViewport.new()
	viewport.size = SCREEN
	add_child_autofree(viewport)
	var backdrop := MenuBackdrop.new()
	viewport.add_child(backdrop)
	return backdrop

func test_camera_lights_and_ball_spot() -> void:
	var backdrop := _backdrop()
	assert_almost_eq(backdrop.camera().fov, MenuBackdrop.FOV, EPS)
	var pose: Dictionary = backdrop.rig.poses[MenuCameraRig.DEFAULT]
	assert_true(backdrop.camera().position.is_equal_approx(pose["position"]), "starts on the default pose")
	assert_almost_eq(backdrop.light().light_energy, MenuBackdrop.LIGHT_INTENSITY / PI, EPS)
	var toward_origin := -backdrop.light().global_basis.z
	assert_true(toward_origin.is_equal_approx(-MenuBackdrop.LIGHT_POSITION.normalized()), "aimed at the stage centre")
	assert_true(backdrop.ball().position.is_equal_approx(MenuBackdrop.PLAYER_SPOT + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)),
		"the sphere centre under the eye spot")

func test_the_ball_waits_out_the_warm_up() -> void:
	var backdrop := _backdrop()
	for i in MenuStageBall.WARMUP_FRAMES:
		backdrop._process(1.0 / 60.0)
	assert_almost_eq(backdrop.stage().opacity, 0.0, EPS)
	backdrop._process(1.0 / 60.0)
	assert_gt(backdrop.stage().opacity, 0.0, "then it fades in")

func test_pinned_light_and_screen_poses() -> void:
	var backdrop := _backdrop()
	backdrop.set_light_angle(PI * 0.5)
	backdrop._process(1.0)
	var pivot := backdrop.find_child("LightOrbit", true, false) as Node3D
	assert_almost_eq(pivot.rotation.y, PI * 0.5, EPS, "a pinned light stays put")
	backdrop.set_screen(MenuCameraRig.SCREEN_LOBBY, GameModes.BATTLE)
	assert_eq(backdrop.rig.state(), MenuCameraRig.LOBBY4)
