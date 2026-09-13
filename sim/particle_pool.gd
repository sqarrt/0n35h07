class_name ParticlePool extends RefCounted
## Fixed pool of fading particles — port of web SpritePool / DeathBurst bookkeeping: emit takes a free slot, step
## moves (optionally with gravity), and opacity / scale fall with the remaining life share. Pure data; nodes draw it.

var _position := PackedVector3Array()
var _velocity := PackedVector3Array()
var _life := PackedFloat32Array()
var _max_life := PackedFloat32Array()
var _base_opacity := PackedFloat32Array()

func _init(count: int) -> void:
	_position.resize(count)
	_velocity.resize(count)
	_life.resize(count)
	_max_life.resize(count)
	_base_opacity.resize(count)
	_max_life.fill(1.0)

func size() -> int:
	return _life.size()

## Put a particle in the first free slot; false when the pool is exhausted (web: skip, minor visual detail).
func emit(position_at: Vector3, life_ms: float, opacity_at: float, velocity_at := Vector3.ZERO) -> bool:
	for i in size():
		if _life[i] <= 0.0:
			set_particle(i, position_at, life_ms, opacity_at, velocity_at)
			return true
	return false

func set_particle(i: int, position_at: Vector3, life_ms: float, opacity_at: float, velocity_at := Vector3.ZERO) -> void:
	_position[i] = position_at
	_velocity[i] = velocity_at
	_life[i] = life_ms
	_max_life[i] = life_ms
	_base_opacity[i] = opacity_at

## Age every live particle; gravity adds to the vertical velocity before moving (web DeathBurst order).
func step(dt: float, gravity := 0.0) -> void:
	var ms := dt * SkinCurves.MS_PER_S
	for i in size():
		if _life[i] <= 0.0:
			continue
		_life[i] -= ms
		if _life[i] <= 0.0:
			continue
		var v := _velocity[i]
		v.y += gravity * dt
		_velocity[i] = v
		_position[i] += v * dt

func alive(i: int) -> bool:
	return _life[i] > 0.0

func alive_count() -> int:
	var n := 0
	for i in size():
		if alive(i):
			n += 1
	return n

func position(i: int) -> Vector3:
	return _position[i]

## Remaining life share, 1 -> 0.
func life_share(i: int) -> float:
	return maxf(_life[i], 0.0) / _max_life[i]

func opacity(i: int) -> float:
	return _base_opacity[i] * life_share(i) if alive(i) else 0.0

func scale(i: int) -> float:
	return life_share(i) if alive(i) else 0.0
