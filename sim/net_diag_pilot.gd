class_name NetDiagPilot extends RefCounted
## What a window does with itself while the network test runs (NetDiag): walk the four sides of a square, sweep the
## aim across it, fire on a steady beat, and now and then dash or raise the shield. Deterministic, so two windows
## behave the same way and their logs compare; the seat index offsets the phase, so players don't move in lockstep.

const LEG_S := 2.0                      # seconds per side of the square
const TURN_SPEED := 0.9                 # radians a second the aim sweeps
const FIRE_INTERVAL_S := 2.0
const DASH_INTERVAL_S := 7.0
const SHIELD_INTERVAL_S := 11.0
const LEGS := [Vector3(0, 0, -1), Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(-1, 0, 0)]
const QUARTER_TURN := PI * 0.5
const WOBBLE := 0.08                    # radians the aim wanders around the target, so shots miss sometimes too
const WOBBLE_SPEED := 1.7

var _age := 0.0
var _seat := 0
var _next := {}                         # interval -> when it next comes due

func _init(seat_index: int) -> void:
	_seat = seat_index
	for interval in [FIRE_INTERVAL_S, DASH_INTERVAL_S, SHIELD_INTERVAL_S]:
		_next[interval] = interval + _seat * LEG_S * 0.5   # the seats act out of step with each other

func step(delta: float) -> void:
	_age += delta

## Where the player walks this frame (MOVE_SPEED units a second), in world axes.
func move() -> Vector3:
	var leg: int = (int(_age / LEG_S) + _seat) % LEGS.size()
	return (LEGS[leg] as Vector3) * MoveConst.MOVE_SPEED

## How far the view has swept since the start, in radians — what the window looks at with nobody to look at.
func yaw() -> float:
	return _age * TURN_SPEED + _seat * QUARTER_TURN

## Where to look to have `target` in the sights from `eye`: the yaw and pitch, wandering a little so the windows
## miss each other now and then instead of trading a kill every beat.
func aim_at(eye: Vector3, target: Vector3) -> Vector2:
	var to_target := target - eye
	var flat := Vector2(to_target.x, to_target.z).length()
	var wander := sin(_age * WOBBLE_SPEED + _seat) * WOBBLE
	return Vector2(atan2(-to_target.x, -to_target.z) + wander, atan2(to_target.y, maxf(flat, 0.001)))

func fires() -> bool:
	return _due(FIRE_INTERVAL_S)

func dashes() -> bool:
	return _due(DASH_INTERVAL_S)

func shields() -> bool:
	return _due(SHIELD_INTERVAL_S)

## Whether this frame is the one that reached the next turn of `interval`.
func _due(interval: float) -> bool:
	if _age < float(_next[interval]):
		return false
	_next[interval] = float(_next[interval]) + interval
	return true
