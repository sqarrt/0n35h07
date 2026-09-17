class_name TeamBarModel
## The match top bar for three or more players — port of the web MatchHud multi-player branch: which roster entries go
## on the left and right panes (stable, never reordered by kills), whether it is a team match, and the team totals.

## A team match (2v2) groups players: fewer distinct teams than players.
static func is_battle(scores: Array, roster_size: int) -> bool:
	var teams := {}
	for score in scores:
		teams[score["team"]] = true
	return teams.size() < roster_size

## {left, right: roster entries, battle: bool}. Battle — my team left, the enemies right; War — me first on the left,
## the others by id, the later half (rounded up) on the right.
static func sides(roster: Array, scores: Array, local_id: int) -> Dictionary:
	var battle := is_battle(scores, roster.size())
	var left: Array = []
	var right: Array = []
	if battle:
		var my_team := team_of(local_id, scores)
		for entry in roster:
			(left if team_of(entry["id"], scores) == my_team else right).append(entry)
	else:
		var others := roster.filter(func(entry: Dictionary) -> bool: return entry["id"] != local_id)
		others.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["id"] < b["id"])
		var right_count := int((others.size() + 1) / 2)
		for entry in roster:
			if entry["id"] == local_id:
				left.append(entry)
		left.append_array(others.slice(0, others.size() - right_count))
		right = others.slice(others.size() - right_count)
	return {"left": left, "right": right, "battle": battle}

static func team_of(id: int, scores: Array) -> int:
	for score in scores:
		if score["id"] == id:
			return score["team"]
	return 0

static func kills_of(id: int, scores: Array) -> int:
	for score in scores:
		if score["id"] == id:
			return score["kills"]
	return 0

static func team_kills(entries: Array, scores: Array) -> int:
	var total := 0
	for entry in entries:
		total += kills_of(entry["id"], scores)
	return total

## The pane's team colour (its first member's team), transparent when the team has no colour.
static func team_color(entries: Array, scores: Array) -> Color:
	if entries.is_empty():
		return Color.TRANSPARENT
	var team := team_of(entries[0]["id"], scores)
	return GameModes.TEAM_COLORS[team] if team < GameModes.TEAM_COLORS.size() else Color.TRANSPARENT
