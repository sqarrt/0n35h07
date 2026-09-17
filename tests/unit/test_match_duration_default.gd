extends GutTest
## A match started from the lobby lasts what the web lobby preselects: every Play resets the duration choice to the
## first option, MATCH_DURATIONS_MIN[0] = 3 minutes (web App.tsx draftSel), not DEFAULT_MATCH_DURATION_MIN.

const MS_PER_MIN := 60000.0
const WEB_FIRST_CHOICE_MIN := 3

func test_lobby_preselects_the_first_duration_choice() -> void:
	assert_eq(MatchConst.LOBBY_DEFAULT_DURATION_MIN, MatchConst.MATCH_DURATIONS_MIN[0])
	assert_eq(MatchConst.LOBBY_DEFAULT_DURATION_MIN, WEB_FIRST_CHOICE_MIN)
	assert_almost_eq(MatchConst.LOBBY_DEFAULT_DURATION_MS, WEB_FIRST_CHOICE_MIN * MS_PER_MIN, 0.001)

func test_game_starts_with_the_lobby_default() -> void:
	var game := get_tree().root.get_node("Game")
	assert_almost_eq(float(game.match_duration_ms), MatchConst.LOBBY_DEFAULT_DURATION_MS, 0.001)
