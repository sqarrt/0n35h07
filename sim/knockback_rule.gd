class_name KnockbackRule
## web Match.maybeKnockback: ball bodies are spheres, so two players whose centres come closer than two radii push
## apart instead of passing through each other. One push per player per tick, along the 3D line from the other centre
## to its own, and never while a push of its own is still running. On a mesh each owner knocks back only the players it
## simulates, against everyone's live positions — both sides see the same overlap without a shared authority.

const OVERLAP_DIST := MoveConst.BALL_RADIUS * 2.0
const FALLBACK_DIR := Vector3.RIGHT

## `players` is every Player in the match; `owns` (optional) tells which of them this peer pushes.
static func apply(players: Array, owns := Callable()) -> void:
	for player in players:
		if not player.alive or player.body.is_knocking():
			continue
		if owns.is_valid() and not bool(owns.call(player.id)):
			continue
		var dir := _push_out_of(player, players)
		if dir != Vector3.ZERO:
			player.body.knockback(dir)

## The way out of the first overlapping player, or zero when nothing overlaps.
static func _push_out_of(player, players: Array) -> Vector3:
	for other in players:
		if other == player or not other.alive:
			continue
		var away: Vector3 = player.body.position - other.body.position
		var distance := away.length()
		if distance >= OVERLAP_DIST:
			continue
		return FALLBACK_DIR if distance < MoveConst.PLAYER_OVERLAP_MIN_DIST else away
	return Vector3.ZERO
