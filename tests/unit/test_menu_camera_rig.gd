extends GutTest
## Menu backdrop camera — web components/menuStage cameraStateFor + MenuBackdrop CameraRig: the pose per screen and
## lobby preset, the poses file, and the damped move (tau 0.06 s, frame steps capped at 0.1 s).

const EPS := 0.0001
const STEP := 0.06

func _rig() -> MenuCameraRig:
	return MenuCameraRig.new(MenuCameraRig.load_poses(MenuCameraRig.POSES_PATH))

func test_pose_per_screen_and_preset() -> void:
	assert_eq(MenuCameraRig.state_for(MenuCameraRig.SCREEN_MENU, GameModes.DUEL, false), MenuCameraRig.DEFAULT)
	assert_eq(MenuCameraRig.state_for(MenuCameraRig.SCREEN_SETTINGS, GameModes.DUEL, false), MenuCameraRig.DEFAULT)
	assert_eq(MenuCameraRig.state_for(MenuCameraRig.SCREEN_LOBBY, GameModes.DUEL, false), MenuCameraRig.ROOM, "Duel host")
	assert_eq(MenuCameraRig.state_for(MenuCameraRig.SCREEN_LOBBY, GameModes.DUEL, true), MenuCameraRig.ROOM_CLIENT)
	assert_eq(MenuCameraRig.state_for(MenuCameraRig.SCREEN_LOBBY, GameModes.BATTLE, false), MenuCameraRig.LOBBY4,
		"Battle / War: the whole square")
	assert_eq(MenuCameraRig.state_for(MenuCameraRig.SCREEN_LOBBY, GameModes.WAR, true), MenuCameraRig.LOBBY4)

func test_poses_come_from_the_web_file() -> void:
	var poses := MenuCameraRig.load_poses(MenuCameraRig.POSES_PATH)
	for state in [MenuCameraRig.DEFAULT, MenuCameraRig.ROOM, MenuCameraRig.ROOM_CLIENT, MenuCameraRig.LOBBY4]:
		assert_true(poses.has(state), state)
	assert_almost_eq((poses[MenuCameraRig.DEFAULT]["position"] as Vector3).y, 2.0326756418240737, EPS)
	var rig := _rig()
	assert_eq(rig.position, poses[MenuCameraRig.DEFAULT]["position"], "the camera starts on the default pose")
	assert_eq(rig.look, poses[MenuCameraRig.DEFAULT]["target"])

func test_the_move_is_damped() -> void:
	var rig := _rig()
	var from := rig.position
	rig.set_state(MenuCameraRig.ROOM)
	var to: Vector3 = rig.poses[MenuCameraRig.ROOM]["position"]
	rig.step(STEP)
	var k := 1.0 - exp(-STEP / MenuCameraRig.DAMP_TAU)
	assert_true(rig.position.is_equal_approx(from.lerp(to, k)), "one tau: 63% of the way")
	var capped := _rig()
	capped.set_state(MenuCameraRig.ROOM)
	capped.step(5.0)
	var capped_k := 1.0 - exp(-MenuCameraRig.MAX_DT / MenuCameraRig.DAMP_TAU)
	assert_true(capped.position.is_equal_approx(from.lerp(to, capped_k)), "a long frame counts as 0.1 s")
