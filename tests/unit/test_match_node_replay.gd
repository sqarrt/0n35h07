extends GutTest
## A MatchNode in replay (the trailer's demo playback feeds the HUD through it): no phase, clock or rules run, the
## clock shows the recording's seconds and the scores / streaks are whatever the playback set on the players.

const RECORDED_SECONDS := 175

func test_the_replay_clock_and_no_rules() -> void:
	var match_node := MatchNode.new()
	add_child_autofree(match_node)
	match_node.replay = true
	match_node.set_duration_ms(MatchConst.DEFAULT_MATCH_DURATION_MS)
	match_node.phase.force_live()
	match_node.replay_seconds_left = RECORDED_SECONDS
	assert_eq(match_node.seconds_left(), RECORDED_SECONDS, "web hudOf: Math.ceil(remainingMs / 1000)")
	match_node._physics_process(MatchConst.DEFAULT_MATCH_DURATION_MS)
	assert_true(match_node.is_live(), "no clock runs out, nothing ends")
	assert_eq(match_node.seconds_left(), RECORDED_SECONDS)
