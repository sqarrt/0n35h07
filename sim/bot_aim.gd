class_name BotAim
## Bot shot aiming. Ported from web controllers/botAim.ts.

const WORLD_UP := Vector3(0, 1, 0)

## Hit/miss roll: true with probability hit_chance. rng is a Callable() -> float in [0,1).
static func roll_hit(hit_chance: float, rng: Callable) -> bool:
	return rng.call() < hit_chance

## Shot aim point. hit=true -> the target's center. hit=false -> a near-miss offset in the
## plane perpendicular to the line of fire by BALL_RADIUS*(1+graze_margin) at a random angle,
## so the shooter->out ray passes just past the hitbox edge (a graze, not an obvious side shot).
static func aim_point(base: Vector3, shooter: Vector3, hit: bool, graze_margin: float, rng: Callable) -> Vector3:
	var out := base
	if hit:
		return out
	var dir := base - shooter
	if dir.length_squared() < 1e-6:
		return out
	dir = dir.normalized()
	var right := dir.cross(WORLD_UP)
	if right.length_squared() < 1e-6:
		right = Vector3(1, 0, 0)   # aiming straight up/down
	right = right.normalized()
	var up := right.cross(dir).normalized()
	var theta: float = rng.call() * TAU
	var mag := MoveConst.BALL_RADIUS * (1.0 + graze_margin)
	out += right * (cos(theta) * mag)
	out += up * (sin(theta) * mag)
	return out
