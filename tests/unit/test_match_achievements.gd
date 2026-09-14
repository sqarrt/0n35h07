extends GutTest
## MatchAchievements — port of web tests/unit/Match.achievements.test.ts: only the local player's events reach the sink —
## their own kills, their own perfect blocks, and a won match (flawless without a death).

const LOCAL_ID := 0
const OTHER_ID := 1
const STREAK := 2

## The MatchNode signals the adapter listens to.
class MatchStandIn extends Node:
	signal frag(shooter_id: int, victim_id: int, streak: int, first_blood: bool)
	signal blocked(shooter_id: int, victim_id: int, perfect: bool)
	signal match_ended(result: Dictionary)
	var local_id := 0

class RecordingSink extends RefCounted:
	var calls: Array = []
	func on_kill(streak: int, first_blood: bool) -> void:
		calls.append(["kill", streak, first_blood])
	func on_perfect_block() -> void:
		calls.append(["block"])
	func on_match_end(won: bool, flawless: bool) -> void:
		calls.append(["end", won, flawless])

var _match: MatchStandIn
var _sink: RecordingSink

func before_each() -> void:
	_match = MatchStandIn.new()
	_match.local_id = LOCAL_ID
	add_child_autofree(_match)
	_sink = RecordingSink.new()
	var adapter := MatchAchievements.new()
	adapter.setup(_match, _sink)
	add_child_autofree(adapter)

func test_own_kills_count_and_others_do_not() -> void:
	_match.frag.emit(LOCAL_ID, OTHER_ID, STREAK, false)
	_match.frag.emit(OTHER_ID, LOCAL_ID, STREAK, true)
	assert_eq(_sink.calls, [["kill", STREAK, false]])

func test_only_an_own_perfect_block_counts() -> void:
	_match.blocked.emit(OTHER_ID, LOCAL_ID, true)
	_match.blocked.emit(OTHER_ID, LOCAL_ID, false)
	_match.blocked.emit(LOCAL_ID, OTHER_ID, true)
	assert_eq(_sink.calls, [["block"]])

func test_a_win_without_a_death_is_flawless() -> void:
	_match.match_ended.emit({"outcome": MatchResult.OUTCOME_WIN,
		"scores": [{"id": LOCAL_ID, "kills": 3, "deaths": 0}, {"id": OTHER_ID, "kills": 0, "deaths": 3}]})
	assert_eq(_sink.calls, [["end", true, true]])

func test_a_win_with_deaths_and_a_loss() -> void:
	_match.match_ended.emit({"outcome": MatchResult.OUTCOME_WIN,
		"scores": [{"id": LOCAL_ID, "kills": 3, "deaths": 1}]})
	_match.match_ended.emit({"outcome": MatchResult.OUTCOME_LOSE, "scores": [{"id": LOCAL_ID, "kills": 0, "deaths": 3}]})
	assert_eq(_sink.calls, [["end", true, false]], "a loss reports nothing")
