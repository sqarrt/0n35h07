class_name SingularityVortex extends RefCounted
## The "singularity" windup world part — port of web SingularityWindupFx: 48 particles spiral into the collapsing ball
## (spin and pull grow with the charge, a disc flattening toward the centre, absorbed particles reborn at the outer
## radius) and a white collapse flash that swells and fades over the first 45% of the deflate.

const PARTICLES := 48
const R_MAX := MoveConst.BALL_RADIUS * 3.2
const R_MIN := MoveConst.BALL_RADIUS * 0.7
const SPIN_MIN := 2.4
const SPIN_GAIN := 3.2
const PULL := 1.4
const DISC_HEIGHT := MoveConst.BALL_RADIUS * 1.6
const SIZE := MoveConst.BALL_RADIUS * 0.16
const OPACITY := 0.9
const APPEAR_FRAC := 0.2
const COLOR := Color("#aaccff")
const FLASH_COLOR := Color.WHITE
const FLASH_FRAC := 0.45
const FLASH_SCALE := 2.6
const FLASH_OPACITY := 0.8
const FLASH_SEGMENTS := 8
const HALF := 0.5

var positions := PackedVector3Array()
var _angles := PackedFloat32Array()
var _radii := PackedFloat32Array()
var _heights := PackedFloat32Array()

func _init(rng: Callable) -> void:
	positions.resize(PARTICLES)
	_angles.resize(PARTICLES)
	_radii.resize(PARTICLES)
	_heights.resize(PARTICLES)
	for i in PARTICLES:
		_reset(i, rng, true)

func radius(i: int) -> float:
	return _radii[i]

## One vortex step at `progress`: spin, pull inward, rebirth below R_MIN, positions relative to the ball centre.
func step(dt: float, progress: float, rng: Callable) -> void:
	var spin := SPIN_MIN + SPIN_GAIN * progress
	var pull := PULL * progress * R_MAX
	for i in PARTICLES:
		_angles[i] += spin * dt
		_radii[i] -= pull * dt
		if _radii[i] < R_MIN:
			_reset(i, rng, false)
		var r := _radii[i]
		positions[i] = Vector3(cos(_angles[i]) * r, _heights[i] * (r / R_MAX), sin(_angles[i]) * r)

static func vortex_opacity(progress: float) -> float:
	return OPACITY * minf(progress / APPEAR_FRAC, 1.0)

## The collapse flash during the deflate: {"visible", "scale", "opacity"}.
static func flash(shrink: float) -> Dictionary:
	var k := minf(shrink / FLASH_FRAC, 1.0)
	return {"visible": k < 1.0, "scale": 1.0 + (FLASH_SCALE - 1.0) * k, "opacity": FLASH_OPACITY * (1.0 - k)}

## web resetParticle: angle, then radius (random over the disc or the outer rim), then height — three draws in order.
func _reset(i: int, rng: Callable, random_radius: bool) -> void:
	_angles[i] = rng.call() * TAU
	_radii[i] = R_MIN + rng.call() * (R_MAX - R_MIN) if random_radius else R_MAX
	_heights[i] = (rng.call() - HALF) * DISC_HEIGHT
