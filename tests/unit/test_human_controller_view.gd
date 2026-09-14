extends GutTest
## Human view parity with web HumanController: first person hides the own model, V toggles the over-the-shoulder view,
## the own shot shakes the camera for five frames, the ghost phase widens the FOV like a dash, clicks are edge events
## and the aim ray starts at the camera only in third person.

const PLAYER := preload("res://scenes/player.tscn")
const DT := 1.0 / 60.0
const EPS := 0.0001
const FOV_EPS := 0.5
const OTHER_ID := 7
const SETTLE_FRAMES := 120

func _rig() -> Array:
	var p: PlayerNode = PLAYER.instantiate()
	add_child_autofree(p)
	var cam: Camera3D = p.get_node("Camera3D")
	var hc := HumanController.new()
	add_child_autofree(hc)
	hc.setup(p, cam)
	return [p, cam, hc]

func test_first_person_hides_the_body_and_v_toggles_the_view() -> void:
	var rig := _rig()
	var p: PlayerNode = rig[0]
	var cam: Camera3D = rig[1]
	var hc: HumanController = rig[2]
	assert_false(p.is_body_visible(), "first person hides the own ball")
	hc.press(&"toggle_view")
	assert_true(hc.is_third_person())
	assert_true(p.is_body_visible())
	hc._process(DT)
	assert_almost_eq(cam.position.x, CameraModel.TP_SHOULDER_X, EPS)
	assert_almost_eq(cam.position.y, CameraModel.TP_HEIGHT, EPS)
	assert_almost_eq(cam.position.z, CameraModel.TP_DIST, EPS)
	hc.press(&"toggle_view")
	hc._process(DT)
	assert_eq(cam.position, Vector3.ZERO, "back to the eye")
	assert_false(p.is_body_visible())

func test_the_profile_default_view_starts_third_person() -> void:
	var p: PlayerNode = PLAYER.instantiate()
	add_child_autofree(p)
	var hc := HumanController.new()
	add_child_autofree(hc)
	hc.setup(p, p.get_node("Camera3D"), true)
	assert_true(hc.is_third_person(), "web defaultThirdPerson")
	assert_true(p.is_body_visible(), "the own ball shows from behind")

func test_only_the_own_shot_shakes_for_five_frames() -> void:
	var rig := _rig()
	var p: PlayerNode = rig[0]
	var cam: Camera3D = rig[1]
	var hc: HumanController = rig[2]
	hc.set_rng(func() -> float: return 1.0)
	hc.on_fired(OTHER_ID)
	hc._process(DT)
	assert_eq(cam.position, Vector3.ZERO, "another player's shot doesn't shake your camera")
	hc.on_fired(p.player.id)
	for i in CameraModel.SHAKE_FRAMES:
		hc._process(DT)
		assert_almost_eq(cam.position.y, CameraModel.SHAKE_RANGE * CameraModel.SHAKE_CENTER, EPS)
	hc._process(DT)
	assert_almost_eq(cam.position.y, 0.0, EPS, "the shake lasts five frames")

func test_ghost_phase_widens_the_fov_like_a_dash() -> void:
	var rig := _rig()
	var p: PlayerNode = rig[0]
	var cam: Camera3D = rig[1]
	var hc: HumanController = rig[2]
	p.player.respawning = true
	for i in SETTLE_FRAMES:
		hc._process(DT)
	assert_almost_eq(cam.fov, CameraModel.FOV_DASH, FOV_EPS)

func test_clicks_are_edge_events() -> void:
	var rig := _rig()
	var p: PlayerNode = rig[0]
	var hc: HumanController = rig[2]
	hc.press(&"fire")
	assert_true(p.player.is_winding_up(), "LMB press starts the windup once (web onFire)")
	hc.press(&"ability")
	assert_true(p.player.is_shielded(), "RMB raises the shield (web onShield)")

func test_aim_ray_starts_at_the_camera_only_in_third_person() -> void:
	var rig := _rig()
	var p: PlayerNode = rig[0]
	var hc: HumanController = rig[2]
	hc.update_aim()
	assert_false(p.player.has_aim_origin(), "first person: the hit ray leaves the muzzle")
	hc.press(&"toggle_view")
	hc._process(DT)
	hc.update_aim()
	assert_true(p.player.has_aim_origin(), "third person: camera -> aim point (no muzzle parallax)")
