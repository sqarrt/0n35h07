extends GutTest
## The multi-player top bar sides — web MatchHud: Battle puts my team left, War puts me first and splits the others by
## id with the later half on the right; team totals and colours.

func _entry(id: int) -> Dictionary:
	return {"id": id, "name": "P%d" % id}

func _score(id: int, team: int, kills: int) -> Dictionary:
	return {"id": id, "team": team, "kills": kills, "deaths": 0}

func test_battle_sides_follow_the_teams() -> void:
	var roster := [_entry(0), _entry(1), _entry(2), _entry(3)]
	var scores := [_score(0, 0, 1), _score(1, 0, 2), _score(2, 1, 4), _score(3, 1, 0)]
	var sides := TeamBarModel.sides(roster, scores, 2)
	assert_true(sides["battle"])
	assert_eq((sides["left"] as Array).map(func(e): return e["id"]), [2, 3], "my team (team 1) on the left")
	assert_eq((sides["right"] as Array).map(func(e): return e["id"]), [0, 1])
	assert_eq(TeamBarModel.team_kills(sides["left"], scores), 4)
	assert_eq(TeamBarModel.team_kills(sides["right"], scores), 3)
	assert_eq(TeamBarModel.team_color(sides["left"], scores), GameModes.TEAM_COLORS[1])

func test_war_splits_the_others_by_id() -> void:
	var roster := [_entry(3), _entry(0), _entry(2), _entry(1)]
	var scores := [_score(0, 0, 0), _score(1, 1, 0), _score(2, 2, 0), _score(3, 3, 0)]
	var sides := TeamBarModel.sides(roster, scores, 0)
	assert_false(sides["battle"], "every player is their own team")
	assert_eq((sides["left"] as Array).map(func(e): return e["id"]), [0, 1], "me first, then the earlier others")
	assert_eq((sides["right"] as Array).map(func(e): return e["id"]), [2, 3], "the later half, rounded up")
	var three := TeamBarModel.sides([_entry(0), _entry(1), _entry(2)], scores.slice(0, 3), 0)
	assert_eq((three["left"] as Array).map(func(e): return e["id"]), [0, 1])
	assert_eq((three["right"] as Array).map(func(e): return e["id"]), [2])
