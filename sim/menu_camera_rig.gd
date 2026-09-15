class_name MenuCameraRig extends RefCounted
## The menu backdrop camera — port of web components/menuStage cameraStateFor + MenuBackdrop CameraRig: a saved pose
## (position + look target, web menuCameraPoses.json) per screen and lobby preset, approached with an exponential
## damping of tau MENU_ANIM_TAU; long frames count as 0.1 s.

const POSES_PATH := "res://assets/menu/menu_camera_poses.json"   # a byte copy of the web poses
const DEFAULT := "default"
const ROOM := "room"                    # lobby, Duel, you host
const ROOM_CLIENT := "roomClient"       # lobby, Duel, you joined
const LOBBY4 := "lobby4"                # lobby, Battle / War: the whole square
const SCREEN_MENU := "menu"
const SCREEN_LOBBY := "lobby"
const SCREEN_SETTINGS := "settings"
const SCREEN_APPEARANCE := "appearance"
## The appearance screen's last clicked block (web AppearancePart) and the pose it asks for.
const PART_COLOR := "color"
const PART_MODEL := "model"
const PART_SHOT := "shot"
const PART_RESPAWN := "respawn"
const PART_DASH := "dash"
const PART_SHIELD := "shield"
const PART_PAINT_FRONT := "paintFront"
const PART_PAINT_BACK := "paintBack"
const APPEARANCE := "appearance"
const APPEARANCE_POSES := {PART_SHOT: "appearanceShot", PART_RESPAWN: "appearanceRespawn", PART_DASH: "appearanceDash",
	PART_SHIELD: "appearanceShield", PART_PAINT_FRONT: "appearancePaintFront", PART_PAINT_BACK: "appearancePaintBack"}
const DAMP_TAU := 0.06                  # web MENU_ANIM_TAU
const MAX_DT := 0.1                     # web Math.min(dtRaw, 0.1)
const POSITION := "position"
const TARGET := "target"

var poses: Dictionary
var position: Vector3
var look: Vector3

var _state := DEFAULT
var hide_ball := false                  # web radio hideBall: the camera tilts up off the ball
var _hide_amount := 0.0

const HIDE_BALL_LOOK_UP := 12.0         # web: the look target rises this far, the ball leaves the frame
const HIDE_BALL_DUR := 0.7              # web: seconds for the whole pan, linear — out and back alike

func _init(pose_table: Dictionary, state := DEFAULT) -> void:
	poses = pose_table
	_state = state
	position = poses[state][POSITION]
	look = poses[state][TARGET]

## {state: {position: Vector3, target: Vector3}} from the web poses JSON.
static func load_poses(path: String) -> Dictionary:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	var out := {}
	for state in parsed:
		var pose: Dictionary = parsed[state]
		out[state] = {POSITION: _vec(pose[POSITION]), TARGET: _vec(pose[TARGET])}
	return out

## web cameraStateFor (menu / lobby / settings; the appearance angles come with that screen).
static func state_for(screen: String, game_mode: String, is_client: bool, part := PART_COLOR) -> String:
	if screen == SCREEN_APPEARANCE:
		return APPEARANCE_POSES.get(part, APPEARANCE)
	if screen == SCREEN_LOBBY:
		if game_mode != GameModes.DUEL:
			return LOBBY4
		return ROOM_CLIENT if is_client else ROOM
	return DEFAULT

func set_state(state: String) -> void:
	_state = state

func state() -> String:
	return _state

## How far the hide-ball tilt has gone, 0..1.
func hide_amount() -> float:
	return _hide_amount

## One render frame: the hide-ball amount moves at a constant speed toward the toggle and raises the look target; the
## position and the look point each close the same share of their distance to the pose.
func step(dt: float) -> void:
	var clamped := minf(dt, MAX_DT)
	_hide_amount = move_toward(_hide_amount, 1.0 if hide_ball else 0.0, clamped / HIDE_BALL_DUR)
	var k := 1.0 - exp(-clamped / DAMP_TAU)
	position = position.lerp(poses[_state][POSITION], k)
	look = look.lerp(poses[_state][TARGET] + Vector3.UP * HIDE_BALL_LOOK_UP * _hide_amount, k)

static func _vec(values: Array) -> Vector3:
	return Vector3(values[0], values[1], values[2])
