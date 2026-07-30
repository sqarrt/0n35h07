class_name HumanController extends Node
## Maps Godot input to Player intents and drives the FP camera.
## PlayerNode calls apply_intent() first each physics tick; mouse-look is event-driven.

const MOUSE_SENSITIVITY := 0.003          # rad per pixel
const PITCH_LIMIT := deg_to_rad(89.0)
const FOV_IDLE := 75.0
const FOV_MOVING := 87.0
const FOV_DASH := 95.0
const FOV_LERP := 6.0

var _pnode: PlayerNode
var _camera: Camera3D
var _pitch := 0.0
var _fov := FOV_IDLE

func setup(pnode: PlayerNode, camera: Camera3D) -> void:
	_pnode = pnode
	_camera = camera
	_pnode.controller = self

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_pnode.rotate_y(-event.relative.x * MOUSE_SENSITIVITY)
		_pitch = clampf(_pitch - event.relative.y * MOUSE_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT)
		_camera.rotation.x = _pitch
	elif event.is_action_pressed("pause"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED

func apply_intent() -> void:
	var player := _pnode.player
	if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
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
	var look := -_camera.global_transform.basis.z
	player.set_look(look)
	if Input.is_action_just_pressed("dash"):
		var d := _dash_dir(look, right)
		if d != Vector3.ZERO:
			player.dash(d)

func _dash_dir(look: Vector3, right: Vector3) -> Vector3:
	var d := Vector3.ZERO
	if Input.is_action_pressed("move_fwd"): d += look
	if Input.is_action_pressed("move_back"): d -= look
	if Input.is_action_pressed("move_right"): d += right
	if Input.is_action_pressed("move_left"): d -= right
	return Vector3.ZERO if d.length_squared() == 0.0 else d.normalized()

func _process(delta: float) -> void:
	if _pnode == null: return
	var moving := Input.is_action_pressed("move_fwd") or Input.is_action_pressed("move_back") \
		or Input.is_action_pressed("move_left") or Input.is_action_pressed("move_right")
	var target := FOV_DASH if _pnode.player.body.is_dashing() else (FOV_MOVING if moving else FOV_IDLE)
	_fov = lerpf(_fov, target, delta * FOV_LERP)
	_camera.fov = _fov
