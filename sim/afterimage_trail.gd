class_name AfterimageTrail extends RefCounted
## "Streak" speed clones — port of web AfterimageTrail: while active, a translucent ball clone every 16 ms at the ball
## centre, living 260 ms (opacity 0.4 -> 0, shrinking). Used by the STREAK dash skin and the echo ghost trail.

var pool := ParticlePool.new(SkinCurves.DASH_TRAIL_COUNT)
var color: Color
var _emit_timer := 0.0

func _init(trail_color: Color) -> void:
	color = trail_color

## `eye` is the player's eye point (web ctx.position); `active` = dashing (or ghost for the respawn trail).
func update(dt: float, active: bool, eye: Vector3) -> void:
	if active:
		_emit_timer -= dt * SkinCurves.MS_PER_S
		if _emit_timer <= 0.0:
			_emit_timer = SkinCurves.DASH_TRAIL_INTERVAL_MS
			pool.emit(eye + Vector3(0.0, SkinCurves.BODY_MESH_Y, 0.0), SkinCurves.DASH_TRAIL_LIFE_MS,
				SkinCurves.DASH_TRAIL_OPACITY)
	else:
		_emit_timer = 0.0
	pool.step(dt)
