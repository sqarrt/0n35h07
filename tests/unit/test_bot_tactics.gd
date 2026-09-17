extends GutTest

func _ctx(kills: int, opp_kills: int, opp_wind: bool, los: bool, dist: float) -> Dictionary:
	return {"kills": kills, "opp_kills": opp_kills, "opp_winding_up": opp_wind,
		"has_los": los, "dist": dist, "evade_near": 6.0}

func test_not_ahead_never_evades() -> void:
	assert_false(BotTactics.should_evade(_ctx(2, 2, true, true, 2.0)))

func test_ahead_and_charged_in_los_evades() -> void:
	assert_true(BotTactics.should_evade(_ctx(3, 1, true, true, 20.0)))

func test_ahead_and_point_blank_evades() -> void:
	assert_true(BotTactics.should_evade(_ctx(3, 1, false, false, 4.0)))

func test_ahead_but_safe_does_not_evade() -> void:
	assert_false(BotTactics.should_evade(_ctx(3, 1, false, true, 20.0)))
