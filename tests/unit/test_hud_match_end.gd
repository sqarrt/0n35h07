extends GutTest
## Match-end screen text parity with web MatchEndedOverlay (English dictionary until i18n lands).

func test_outcome_labels() -> void:
	assert_eq(HudModel.outcome_label(MatchResult.OUTCOME_WIN), "VICTORY")
	assert_eq(HudModel.outcome_label(MatchResult.OUTCOME_LOSE), "DEFEAT")
	assert_eq(HudModel.outcome_label(MatchResult.OUTCOME_DRAW), "DRAW")

func test_reason_label() -> void:
	assert_eq(HudModel.reason_label(MatchResult.REASON_TIME), "TIME UP")

func test_players_ranked_by_kills_then_id() -> void:
	var scores := [
		{"id": 2, "kills": 1, "deaths": 0, "team": 0},
		{"id": 0, "kills": 3, "deaths": 1, "team": 0},
		{"id": 1, "kills": 1, "deaths": 2, "team": 1},
	]
	var ids := HudModel.ranked_scores(scores).map(func(s): return s["id"])
	assert_eq(ids, [0, 1, 2], "kills descending, equal kills by id (web sort)")
