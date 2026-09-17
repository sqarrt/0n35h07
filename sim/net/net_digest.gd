class_name NetDigest
## The peers' agreement, checked out loud. Scores, streaks and the match phase are never sent — every peer derives them
## from the same slim events — so a single lost or doubled event drifts one screen away from the others and nothing
## says so. Every couple of seconds each peer sends what it believes (phase, seconds left, and per player: alive,
## kills, deaths, where it stands) and compares the others' beliefs with its own; a disagreement is one warning line
## in the session log, which is also what a live test reads to prove the peers agreed.

const INTERVAL_S := 2.0                 # how often a peer states its world
const POSITION_TOLERANCE := 2.5         # metres: remotes are drawn ~100 ms in the past, so positions differ honestly
const SECONDS_TOLERANCE := 2.0          # the clocks start a latency apart

static func of(phase_name: String, seconds_left, scores: Array, positions: Dictionary) -> Dictionary:
	var players := []
	for score in scores:
		var id := int(score["id"])
		var at: Vector3 = positions.get(id, Vector3.ZERO)
		players.append({"id": id, "kills": int(score["kills"]), "deaths": int(score["deaths"]),
			"pos": [at.x, at.y, at.z]})
	return {"phase": phase_name, "left": seconds_left if seconds_left != null else -1, "players": players}

## What `theirs` says that `ours` does not, as short reasons ([] when the two agree).
static func disagreements(ours: Dictionary, theirs: Dictionary) -> Array:
	var out: Array = []
	if String(ours.get("phase", "")) != String(theirs.get("phase", "")):
		out.append("phase %s/%s" % [ours.get("phase"), theirs.get("phase")])
	if absf(float(ours.get("left", -1)) - float(theirs.get("left", -1))) > SECONDS_TOLERANCE:
		out.append("clock %s/%s" % [ours.get("left"), theirs.get("left")])
	var mine := {}
	for player in ours.get("players", []):
		mine[int(player["id"])] = player
	for player in theirs.get("players", []):
		var id := int(player["id"])
		if not mine.has(id):
			continue                    # a player one side has already let go of: the leave path reports that itself
		var ours_player: Dictionary = mine[id]
		if int(ours_player["kills"]) != int(player["kills"]) or int(ours_player["deaths"]) != int(player["deaths"]):
			out.append("score %d %d-%d/%d-%d" % [id, ours_player["kills"], ours_player["deaths"],
				player["kills"], player["deaths"]])
		if _distance(ours_player["pos"], player["pos"]) > POSITION_TOLERANCE:
			out.append("pos %d %.1f" % [id, _distance(ours_player["pos"], player["pos"])])
	return out

static func _distance(a: Array, b: Array) -> float:
	return Vector3(a[0], a[1], a[2]).distance_to(Vector3(b[0], b[1], b[2]))
