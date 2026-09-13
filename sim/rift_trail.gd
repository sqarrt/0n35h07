class_name RiftTrail extends RefCounted
## "Rift" dash skin — port of web RiftTrail: while dashing, an R/G/B triplet of ball copies every 40 ms spread across the
## motion (±0.12), fading from 0.35 over 260 ms and flickering to 40% every other 110 ms (photosensitivity-limited).

const INTERVAL_MS := 40.0
const LIFE_MS := 260.0
const POOL := 8
const RADIUS := MoveConst.BALL_RADIUS * 0.95
const OFFSET := 0.12
const OPACITY := 0.35
const FLICKER_INTERVAL_MS := 110.0
const FLICKER_DIM := 0.4
const CHANNELS := [Color("#f33"), Color("#3f3"), Color("#33f")]
const SHIFTS := [1.0, 0.0, -1.0]             # R / G / B along the lateral axis
const FLICKER_PHASES := 2
const MIN_DELTA_SQ := 1e-8

var centers := PackedVector3Array()
var perpendiculars := PackedVector3Array()
var _life := PackedFloat32Array()
var _emit_timer := 0.0
var _flicker_clock := 0.0
var _last := Vector3.ZERO
var _has_last := false
var _perp := Vector3.BACK

func _init() -> void:
	centers.resize(POOL)
	perpendiculars.resize(POOL)
	_life.resize(POOL)

func update(dt: float, dashing: bool, eye: Vector3) -> void:
	var ms := dt * SkinCurves.MS_PER_S
	_flicker_clock += ms
	if dashing:
		if _has_last:
			var delta := eye - _last
			if delta.length_squared() > MIN_DELTA_SQ:
				var p := delta.cross(Vector3.UP)
				if p.length_squared() > MIN_DELTA_SQ:
					_perp = p.normalized()
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

## Opacity of every copy of triplet `i` (the flicker dims all live copies together).
func opacity(i: int) -> float:
	if not alive(i):
		return 0.0
	var dim := FLICKER_DIM if floori(_flicker_clock / FLICKER_INTERVAL_MS) % FLICKER_PHASES == 1 else 1.0
	return OPACITY * _life[i] / LIFE_MS * dim

func channel_position(i: int, channel: int) -> Vector3:
	return centers[i] + perpendiculars[i] * SHIFTS[channel] * OFFSET

func _emit(eye: Vector3) -> void:
	for i in POOL:
		if _life[i] <= 0.0:
			centers[i] = eye + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0)
			perpendiculars[i] = _perp
			_life[i] = LIFE_MS
			return
