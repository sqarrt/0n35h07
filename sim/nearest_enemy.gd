class_name NearestEnemy
## A bot's target — port of web Match.nearestEnemy: the nearest living player of another team (teammates and the dead
## are skipped); null when nobody hostile is up.

static func of(player, players: Array):
	var best = null
	var best_distance := INF
	for other in players:
		if other == player or other.team == player.team or not other.alive:
			continue
		var distance: float = (other.body.position as Vector3).distance_to(player.body.position)
		if distance < best_distance:
			best_distance = distance
			best = other
	return best
