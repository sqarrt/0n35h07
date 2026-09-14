class_name HumanController extends Node
## Maps Godot input to Player intents and drives the camera — port of web HumanController + Game.tsx input:
## WASD / Space are held; LMB fire, RMB shield, Shift dash and V view are edge events (web DOM handlers, pointer lock
## only). Mouse-look follows PointerLockControls; the aim is a camera ray into the world (hit point, else AIM_RANGE)
## and the hit ray starts at the camera only in third person. The view (CameraModel): dynamic FOV, the own-shot shake,
## first person (own ball hidden) or the over-the-shoulder third person.
## PlayerNode calls apply_intent() first each physics tick.

const EDGE_ACTIONS := [&"fire", &"ability", &"dash", &"toggle_view"]

var _pnode: PlayerNode
var _camera: Camera3D
var _raycaster: WorldRaycaster
var _pitch := 0.0
var _fov := CameraModel.FOV_IDLE
var _third_person := false
var _shake_left := 0
var _random := RandomNumberGenerator.new()
var _rng: Callable

func _init() -> void:
	_random.randomize()
	_rng = _random.randf

## `third_person`: the profile's default view (web HumanController defaultThirdPerson).
func setup(pnode: PlayerNode, camera: Camera3D, third_person := false) -> void:
	_pnode = pnode
	_camera = camera
	_third_person = third_person
	_pnode.controller = self
	_raycaster = WorldRaycaster.new(pnode.get_world_3d().direct_space_state)
	_pnode.set_body_visible(_third_person)   # web: the first-person view hides the own model

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

## Inject the shake random source (tests).
func set_rng(rng: Callable) -> void:
	_rng = rng

func is_third_person() -> bool:
	return _third_person

## web shake(): jolt the camera for five frames.
func shake() -> void:
	_shake_left = CameraModel.SHAKE_FRAMES

## MatchNode.fired: only this controller's player's own shot shakes the camera (web: shooter === human).
func on_fired(shooter_id: int) -> void:
	if _pnode != null and shooter_id == _pnode.player.id:
		shake()

func toggle_view() -> void:
	_third_person = not _third_person
	_pnode.set_body_visible(_third_person)

## One edge action, as the web DOM handlers run it (fire / ability / dash / toggle_view).
func press(action: StringName) -> void:
	var player := _pnode.player
	match action:
		&"fire":
			player.start_firing()
		&"ability":
			player.activate_shield()
		&"dash":
			var look := -_camera.global_basis.z
			var d := _dash_dir(look, _horizontal_right(look))
			if d != Vector3.ZERO:
				player.dash(d)
		&"toggle_view":
			toggle_view()

func _pointer_locked() -> bool:
	return Input.mouse_mode == Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
	if _pnode == null or not _pointer_locked():
		return
	if event is InputEventMouseMotion:
		var winding := _pnode.player.is_winding_up()
		_pnode.rotate_y(-CameraModel.look_delta_rad(event.relative.x, winding))
		_pitch = CameraModel.clamp_pitch(_pitch - CameraModel.look_delta_rad(event.relative.y, winding))
		_camera.rotation.x = _pitch
		return
	for action in EDGE_ACTIONS:
		if event.is_action_pressed(action, false):
			press(action)

func apply_intent(_delta: float = 0.0) -> void:
	var player := _pnode.player
	if not _pointer_locked():
		player.move_intent(Vector3.ZERO)
		player.set_jump_input(false)
		return
	var basis := _pnode.global_transform.basis
	var fwd := Vector3(-basis.z.x, 0, -basis.z.z).normalized()
	var right := Vector3(basis.x.x, 0, basis.x.z).normalized()
	var wish := Vector3.ZERO
	if Input.is_action_pressed("move_fwd"): wish += fwd
	if Input.is_action_pressed("move_back"): wish -= fwd
	if Input.is_action_pressed("move_right"): wish += right
	if Input.is_action_pressed("move_left"): wish -= right
	if wish.length_squared() > 0.0: wish = wish.normalized() * MoveConst.MOVE_SPEED
	player.move_intent(wish)
	player.set_jump_input(Input.is_action_pressed("jump"))
	player.set_look(-_camera.global_basis.z)
	update_aim()

## Aim where the camera looks: the nearest world / body hit, else AIM_RANGE ahead (web HumanController.update).
func update_aim() -> void:
	var origin := _camera.global_position
	var look := -_camera.global_basis.z
	var hit = _raycaster.raycast(origin, look, [_pnode.hitbox_rid()], _pnode.player.pierce_walls)
	var point: Vector3 = hit.point if hit != null else origin + look * CombatConst.AIM_RANGE
	_pnode.player.aim(point, origin if _third_person else null)

func _dash_dir(look: Vector3, right: Vector3) -> Vector3:
	var d := Vector3.ZERO
	if Input.is_action_pressed("move_fwd"): d += look
	if Input.is_action_pressed("move_back"): d -= look
	if Input.is_action_pressed("move_right"): d += right
	if Input.is_action_pressed("move_left"): d -= right
	return Vector3.ZERO if d.length_squared() == 0.0 else d.normalized()

func _horizontal_right(look: Vector3) -> Vector3:
	return Vector3(-look.z, 0.0, look.x).normalized()

func _process(delta: float) -> void:
	if _pnode == null:
		return
	var player := _pnode.player
	var moving := Input.is_action_pressed("move_fwd") or Input.is_action_pressed("move_back") \
		or Input.is_action_pressed("move_left") or Input.is_action_pressed("move_right")
	var target := CameraModel.fov_target(player.body.is_dashing(), player.respawning, player.is_winding_up(), moving)
	_fov = CameraModel.fov_step(_fov, target, delta)
	_camera.fov = _fov
	_place_camera()

## Eye (with the step-rise lag) or the third-person spot along the camera's pitched axes, plus a shake frame.
func _place_camera() -> void:
	var local := Vector3(0.0, -_pnode.step_lag(), 0.0)
	if _third_person:
		local = CameraModel.third_person_position(local, _camera.transform.basis)
	if _shake_left > 0:
		local += _pnode.global_basis.inverse() * CameraModel.shake_offset(_rng)   # web shakes world x / y
		_shake_left -= 1
	_camera.position = local
