class_name MatchResult extends RefCounted
## Match outcome — port of web Match.computeResult (the time-up path; disconnect arrives with network play).
## Teams are ranked by the sum of their members' kills; the local team wins, draws (several top teams) or loses.

const OUTCOME_WIN := "win"
const OUTCOME_LOSE := "lose"
const OUTCOME_DRAW := "draw"
const REASON_TIME := "time"

## players: Array of Player. Returns {outcome, reason, scores: [{id, kills, deaths, team}],
## ranking: [{team, kills, member_ids}]} with ranking sorted by kills, ties in first-appearance order.
static func compute(players: Array, local_team: int, reason: String) -> Dictionary:
	var scores: Array = []
	var by_team := {}   # team -> ranking row; insertion order = first appearance (web Map)
	for p in players:
		scores.append({"id": p.id, "kills": p.kills, "deaths": p.deaths, "team": p.team})
		if not by_team.has(p.team):
			by_team[p.team] = {"team": p.team, "kills": 0, "member_ids": []}
		by_team[p.team]["kills"] += p.kills
		by_team[p.team]["member_ids"].append(p.id)
	var ranking: Array = by_team.values()
	_stable_sort_by_kills(ranking)
	var outcome := OUTCOME_LOSE
	if not ranking.is_empty():
		var top: int = ranking[0]["kills"]
		var top_teams := ranking.filter(func(r): return r["kills"] == top)
		if top_teams.any(func(r): return r["team"] == local_team):
			outcome = OUTCOME_DRAW if top_teams.size() > 1 else OUTCOME_WIN
	return {"outcome": outcome, "reason": reason, "scores": scores, "ranking": ranking}

## Kills descending; ties keep their order (JS Array.prototype.sort is stable, Godot's sort_custom is not).
static func _stable_sort_by_kills(rows: Array) -> void:
	for i in range(1, rows.size()):
		var row = rows[i]
		var j := i - 1
		while j >= 0 and rows[j]["kills"] < row["kills"]:
			rows[j + 1] = rows[j]
			j -= 1
		rows[j + 1] = row
