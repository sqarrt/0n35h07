class_name WaveTrail extends RefCounted
## "Wave" dash skin — port of web WaveTrail: while dashing, a shockwave ring every 25 ms at the ball centre with its
## plane across the motion; rings expand (scale 1 + 3.5·age s) and fade from 0.7 over 450 ms.

const INTERVAL_MS := 25.0
const LIFE_MS := 450.0
const POOL := 20
const INNER := 0.3
const OUTER := 0.38
const SEGMENTS := 24
const GROW := 3.5
const OPACITY := 0.7
const MIN_DELTA_SQ := 1e-8

var positions := PackedVector3Array()
var normals := PackedVector3Array()          # ring plane normal = the movement direction at emit
var _life := PackedFloat32Array()
var _emit_timer := 0.0
var _last := Vector3.ZERO
var _has_last := false
var _direction := Vector3.RIGHT

func _init() -> void:
	positions.resize(POOL)
	normals.resize(POOL)
	_life.resize(POOL)

func update(dt: float, dashing: bool, eye: Vector3) -> void:
	var ms := dt * SkinCurves.MS_PER_S
	if dashing:
		if _has_last:
			var delta := eye - _last
			if delta.length_squared() > MIN_DELTA_SQ:
				_direction = delta.normalized()
		_emit_timer -= ms
		if _emit_timer <= 0.0:
			_emit_timer = INTERVAL_MS
			_emit(eye)
	else:
		_emit_timer = 0.0
		_has_last = false
	_last = eye
	if dashing:
		_has_last = true
	for i in POOL:
		if _life[i] > 0.0:
			_life[i] -= ms

func alive(i: int) -> bool:
	return _life[i] > 0.0

func alive_count() -> int:
	var n := 0
	for i in POOL:
		if alive(i):
			n += 1
	return n

func opacity(i: int) -> float:
	return OPACITY * _life[i] / LIFE_MS if alive(i) else 0.0

func scale(i: int) -> float:
	return 1.0 + GROW * (LIFE_MS - _life[i]) / SkinCurves.MS_PER_S

func _emit(eye: Vector3) -> void:
	for i in POOL:
		if _life[i] <= 0.0:
			positions[i] = eye + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)
			normals[i] = _direction
			_life[i] = LIFE_MS
			return
