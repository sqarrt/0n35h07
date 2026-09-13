class_name CameraModel
## Human camera rules — port of web HumanController (view part) + three PointerLockControls: the dynamic FOV target
## and smoothing, mouse-look sensitivity with the windup slow-down, the pitch limit, the own-shot shake and the
## over-the-shoulder third-person offset. Pure maths; HumanController applies it.

const FOV_IDLE := 75.0
const FOV_MOVING := 87.0
const FOV_WINDUP := 70.0
const FOV_DASH := 95.0              # web DASH_FOV: the dash and the ghost phase (×2 speed)
const FOV_LERP := 6.0               # web lerp(fov, target, dt * 6)
const LOOK_RAD_PER_PX := 0.002      # three PointerLockControls _MOUSE_SENSITIVITY (pointerSpeed 1)
const WINDUP_LOOK_FACTOR := 0.15    # web WINDUP_LOOK_FACTOR (pointerSpeed while charging)
const PITCH_LIMIT := PI / 2.0       # PointerLockControls clamps the pitch to ±π/2
const SHAKE_FRAMES := 5             # web shake(): five render frames
const SHAKE_RANGE := 0.04           # web (Math.random() - 0.5) * 0.04 per axis
const SHAKE_CENTER := 0.5
const TP_DIST := 4.0                # web TP_DIST: behind the player
const TP_HEIGHT := 1.5              # web TP_HEIGHT: above
const TP_SHOULDER_X := 0.7          # web TP_SHOULDER_X: to the right

static func fov_target(dashing: bool, respawning: bool, winding_up: bool, moving: bool) -> float:
	if dashing or respawning:
		return FOV_DASH
	if winding_up:
		return FOV_WINDUP
	return FOV_MOVING if moving else FOV_IDLE

static func fov_step(fov: float, target: float, dt: float) -> float:
	return lerpf(fov, target, dt * FOV_LERP)

## Mouse movement in pixels -> rotation in radians.
static func look_delta_rad(pixels: float, winding_up: bool) -> float:
	return pixels * LOOK_RAD_PER_PX * (WINDUP_LOOK_FACTOR if winding_up else 1.0)

static func clamp_pitch(pitch: float) -> float:
	return clampf(pitch, -PITCH_LIMIT, PITCH_LIMIT)

## One shake frame: world x / y jitter from two random draws in [0, 1).
static func shake_offset(rng: Callable) -> Vector3:
	var x: float = (rng.call() - SHAKE_CENTER) * SHAKE_RANGE
	var y: float = (rng.call() - SHAKE_CENTER) * SHAKE_RANGE
	return Vector3(x, y, 0.0)

## Third-person camera position from the eye point along the camera's own axes (web renderCamera: forward is -Z).
static func third_person_position(eye: Vector3, camera_basis: Basis) -> Vector3:
	return eye + camera_basis.z * TP_DIST + camera_basis.x * TP_SHOULDER_X + camera_basis.y * TP_HEIGHT
