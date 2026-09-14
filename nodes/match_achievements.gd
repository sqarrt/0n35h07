class_name MatchAchievements extends Node
## The local player's achievement events from a match — web Match calls its IAchievements sink for localId only
## (announceStreak: own kills; applyBlock: own perfect blocks; endMatch: a win, flawless without a death). Here the
## MatchNode's frag / blocked / match_ended signals are filtered by its local_id and handed to the sink.

var _match: Node
var _sink: Object

## `sink`: on_kill(streak, first_blood), on_perfect_block(), on_match_end(won, flawless) — SteamAchievements.
func setup(match_node: Node, sink: Object) -> void:
	_match = match_node
	_sink = sink
	match_node.connect("frag", _on_frag)
	match_node.connect("blocked", _on_blocked)
	match_node.connect("match_ended", _on_match_ended)

func _local_id() -> int:
	return int(_match.get("local_id"))

func _on_frag(shooter_id: int, _victim_id: int, streak: int, first_blood: bool) -> void:
	if shooter_id == _local_id():
		_sink.on_kill(streak, first_blood)

func _on_blocked(_shooter_id: int, victim_id: int, perfect: bool) -> void:
	if perfect and victim_id == _local_id():
		_sink.on_perfect_block()

func _on_match_ended(result: Dictionary) -> void:
	if result.get("outcome") != MatchResult.OUTCOME_WIN:
		return
	var deaths := 0
	for row: Dictionary in result.get("scores", []):
		if int(row["id"]) == _local_id():
			deaths = int(row["deaths"])
	_sink.on_match_end(true, deaths == 0)
