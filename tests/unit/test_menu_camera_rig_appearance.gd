extends GutTest
## Appearance camera poses — web menuStage cameraStateFor: the appearance screen's last clicked block picks the angle
## (colour and model share the base pose), and every one of them is in the web poses file.

func test_parts_pick_their_poses() -> void:
	var screen := MenuCameraRig.SCREEN_APPEARANCE
	assert_eq(MenuCameraRig.state_for(screen, GameModes.DUEL, false), MenuCameraRig.APPEARANCE, "colour")
	assert_eq(MenuCameraRig.state_for(screen, GameModes.DUEL, false, MenuCameraRig.PART_MODEL), MenuCameraRig.APPEARANCE)
	assert_eq(MenuCameraRig.state_for(screen, GameModes.DUEL, false, MenuCameraRig.PART_SHOT), "appearanceShot")
	assert_eq(MenuCameraRig.state_for(screen, GameModes.DUEL, false, MenuCameraRig.PART_PAINT_BACK), "appearancePaintBack")
	assert_eq(MenuCameraRig.state_for(MenuCameraRig.SCREEN_MENU, GameModes.DUEL, false, MenuCameraRig.PART_SHOT),
		MenuCameraRig.DEFAULT, "parts only move the appearance camera")

func test_every_appearance_pose_is_saved() -> void:
	var poses := MenuCameraRig.load_poses(MenuCameraRig.POSES_PATH)
	assert_true(poses.has(MenuCameraRig.APPEARANCE))
	for pose in MenuCameraRig.APPEARANCE_POSES.values():
		assert_true(poses.has(pose), pose)
