class_name DeathBurst extends RefCounted
## Particle burst on death — port of web DeathBurst: 14 additive spheres in the player colour scatter outward and up
## (speed 6), fall with gravity, fade from 0.9 and shrink over 400 ms.

const HALF := 0.5
const SPREAD := 2.0

var pool := ParticlePool.new(SkinCurves.DEATH_BURST_COUNT)
var color: Color

func _init(burst_color: Color) -> void:
	color = burst_color

## Scatter every particle from `origin` (web emit: random x/z in ±speed, y in 0..speed).
func emit(origin: Vector3, rng: Callable) -> void:
	for i in pool.size():
		var velocity := Vector3((rng.call() - HALF) * SPREAD * SkinCurves.DEATH_BURST_SPEED,
			rng.call() * SkinCurves.DEATH_BURST_SPEED,
			(rng.call() - HALF) * SPREAD * SkinCurves.DEATH_BURST_SPEED)
		pool.set_particle(i, origin, SkinCurves.DEATH_BURST_LIFE_MS, SkinCurves.DEATH_BURST_OPACITY, velocity)

func update(dt: float) -> void:
	pool.step(dt, MoveConst.GRAVITY)
