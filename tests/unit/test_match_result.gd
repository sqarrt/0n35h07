extends GutTest
## Match outcome parity with web Match.computeResult: teams ranked by summed kills;
## the local team wins, draws (several top teams) or loses.

const LOCAL_TEAM := 0
const OTHER_TEAM := 1

func _player(id: int, team: int, kills: int, deaths := 0) -> Player:
	var p := Player.new()
	p.id = id
	p.team = team
	p.kills = kills
	p.deaths = deaths
	return p

func test_local_team_with_most_kills_wins() -> void:
	var r := MatchResult.compute([_player(0, LOCAL_TEAM, 3), _player(1, OTHER_TEAM, 1)], LOCAL_TEAM, MatchResult.REASON_TIME)
	assert_eq(r["outcome"], MatchResult.OUTCOME_WIN)
	assert_eq(r["reason"], MatchResult.REASON_TIME)

func test_fewer_kills_loses() -> void:
	var r := MatchResult.compute([_player(0, LOCAL_TEAM, 1), _player(1, OTHER_TEAM, 2)], LOCAL_TEAM, MatchResult.REASON_TIME)
	assert_eq(r["outcome"], MatchResult.OUTCOME_LOSE)

func test_tied_top_teams_draw() -> void:
	var r := MatchResult.compute([_player(0, LOCAL_TEAM, 2), _player(1, OTHER_TEAM, 2)], LOCAL_TEAM, MatchResult.REASON_TIME)
	assert_eq(r["outcome"], MatchResult.OUTCOME_DRAW)

func test_team_kills_are_summed_and_ranked_descending() -> void:
	var players := [_player(0, LOCAL_TEAM, 1), _player(2, LOCAL_TEAM, 1), _player(1, OTHER_TEAM, 3), _player(3, OTHER_TEAM, 0)]
	var r := MatchResult.compute(players, LOCAL_TEAM, MatchResult.REASON_TIME)
	assert_eq(r["ranking"][0]["team"], OTHER_TEAM)
	assert_eq(r["ranking"][0]["kills"], 3)
	assert_eq(r["ranking"][1]["kills"], 2, "a team's members' kills add up")
	assert_eq(r["ranking"][1]["member_ids"], [0, 2])
	assert_eq(r["outcome"], MatchResult.OUTCOME_LOSE)

func test_scores_list_every_player() -> void:
	var r := MatchResult.compute([_player(0, LOCAL_TEAM, 2, 1), _player(1, OTHER_TEAM, 1, 2)], LOCAL_TEAM, MatchResult.REASON_TIME)
	assert_eq(r["scores"], [
		{"id": 0, "kills": 2, "deaths": 1, "team": LOCAL_TEAM},
		{"id": 1, "kills": 1, "deaths": 2, "team": OTHER_TEAM},
	])
