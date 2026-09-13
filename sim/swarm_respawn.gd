class_name SwarmRespawn extends RefCounted
## The "swarm" respawn skin — port of web SwarmRespawnFx: on death the ball shatters into 60 tetrahedra that scatter,
## are captured into bobbing orbits around a damped centre following the ghost, and leave fading clones; on rebirth
## they gather into the origin while the ball ignites from half size (ease-out).

const FRAGMENTS := 60
const FRAG_SIZE := 0.09
const SCATTER_MS := 350.0
const SCATTER_SPEED := 5.0
const ORBIT_R_MIN := 0.5
const ORBIT_R_MAX := 1.3
const ORBIT_SPEED_MIN := 1.6
const ORBIT_SPEED_MAX := 3.4
const ORBIT_CAPTURE := 0.25
const ORBIT_CAPTURE_MIN := 0.02
const BOB_AMP := 0.35
const BOB_HZ := 0.9
const FOLLOW_LERP := 0.12
const GATHER_MS := 280.0
const GATHER_LERP_BASE := 0.12
const GATHER_LERP_GAIN := 0.6
const REBIRTH_SCALE_FROM := 0.5
const SPIN_Y_FRAC := 0.7
const TRAIL_CLONES := 24
const TRAIL_INTERVAL_MS := 28.0
const TRAIL_LIFE_MS := 320.0
const TRAIL_OPACITY := 0.5
const SCATTER_UP_BIAS := 0.2
const HALF := 0.5
const SPREAD := 2.0

var positions := PackedVector3Array()
var rotations := PackedVector3Array()
var trail_positions := PackedVector3Array()
var trail_rotations := PackedVector3Array()
var world_visible := false
var _angles := PackedFloat32Array()
var _radii := PackedFloat32Array()
var _speeds := PackedFloat32Array()
var _heights := PackedFloat32Array()
var _scatter := PackedVector3Array()
var _trail_life := PackedFloat32Array()
var _trail_timer_ms := 0.0
var _trail_next := 0
var _since_death_ms := INF
var _center := Vector3.ZERO
var _center_init := false
var _time_s := 0.0

func _init(rng: Callable) -> void:
	for arr in [positions, rotations, _scatter]:
		arr.resize(FRAGMENTS)
	for arr in [_angles, _radii, _speeds, _heights]:
		arr.resize(FRAGMENTS)
	trail_positions.resize(TRAIL_CLONES)
	trail_rotations.resize(TRAIL_CLONES)
	_trail_life.resize(TRAIL_CLONES)
	for i in FRAGMENTS:   # web order per fragment: angle, radius, speed, bob phase
		_angles[i] = rng.call() * TAU
		_radii[i] = ORBIT_R_MIN + rng.call() * (ORBIT_R_MAX - ORBIT_R_MIN)
		_speeds[i] = ORBIT_SPEED_MIN + rng.call() * (ORBIT_SPEED_MAX - ORBIT_SPEED_MIN)
		_heights[i] = rng.call() * TAU

func on_death(origin: Vector3, rng: Callable) -> void:
	_since_death_ms = 0.0
	_center = origin
	_center_init = true
	for i in FRAGMENTS:
		positions[i] = origin
		var dir := Vector3((rng.call() - HALF) * SPREAD, rng.call() - SCATTER_UP_BIAS, (rng.call() - HALF) * SPREAD)
		_scatter[i] = dir.normalized() * SCATTER_SPEED * (HALF + rng.call() * HALF)

## The bob clock runs on every frame (web: time advances at the top of apply).
func advance(dt: float) -> void:
	_time_s += dt

## Ghost phase: the swarm marks the player (the ball is hidden).
func ghost_step(dt: float, origin: Vector3, rng: Callable) -> void:
	if not _center_init:
		_center = origin
		_center_init = true
	world_visible = true
	_center = _center.lerp(origin, FOLLOW_LERP)
	_since_death_ms += dt * SkinCurves.MS_PER_S
	var orbit_k := minf(_since_death_ms / SCATTER_MS, 1.0)
	for i in FRAGMENTS:
		if orbit_k < 1.0:
			positions[i] += _scatter[i] * dt * (1.0 - orbit_k)
		_angles[i] += _speeds[i] * dt
		positions[i] = positions[i].lerp(_orbit_point(i), maxf(orbit_k * ORBIT_CAPTURE, ORBIT_CAPTURE_MIN))
		rotations[i] += Vector3(dt * _speeds[i], dt * _speeds[i] * SPIN_Y_FRAC, 0.0)
	_step_trail(dt, rng)

static func is_rebirth(since_rebirth_ms: float) -> bool:
	return since_rebirth_ms >= 0.0 and since_rebirth_ms < GATHER_MS

## Rebirth window: fragments gather into the origin; returns the ball scale (ignition from half size).
func rebirth_step(since_rebirth_ms: float, origin: Vector3) -> float:
	var k := since_rebirth_ms / GATHER_MS
	var pop := 1.0 - pow(1.0 - k, 2.0)
	world_visible = k < 1.0
	for i in FRAGMENTS:
		positions[i] = positions[i].lerp(origin, minf(1.0, k * GATHER_LERP_GAIN + GATHER_LERP_BASE))
	return REBIRTH_SCALE_FROM + (1.0 - REBIRTH_SCALE_FROM) * pop

## First frame outside the phases.
func reset_neutral() -> void:
	world_visible = false
	_since_death_ms = INF
	_center_init = false

## Trail clones fade even outside the phases.
func update_trail(dt: float) -> void:
	for i in TRAIL_CLONES:
		if _trail_life[i] > 0.0:
			_trail_life[i] -= dt * SkinCurves.MS_PER_S

func trail_alive(i: int) -> bool:
	return _trail_life[i] > 0.0

func trail_opacity(i: int) -> float:
	return TRAIL_OPACITY * _trail_life[i] / TRAIL_LIFE_MS if trail_alive(i) else 0.0

func _step_trail(dt: float, rng: Callable) -> void:
	_trail_timer_ms -= dt * SkinCurves.MS_PER_S
	if _trail_timer_ms > 0.0:
		return
	_trail_timer_ms = TRAIL_INTERVAL_MS
	var source := floori(rng.call() * FRAGMENTS)
	trail_positions[_trail_next] = positions[source]
	trail_rotations[_trail_next] = rotations[source]
	_trail_life[_trail_next] = TRAIL_LIFE_MS
	_trail_next = (_trail_next + 1) % TRAIL_CLONES

func _orbit_point(i: int) -> Vector3:
	var r := _radii[i]
	return Vector3(_center.x + cos(_angles[i]) * r,
		_center.y + sin(_time_s * BOB_HZ * TAU + _heights[i]) * BOB_AMP,
		_center.z + sin(_angles[i]) * r)
