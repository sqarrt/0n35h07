extends GutTest
## Streak banner words — web announceStreak announces every shooter's streak (not only the local player's).

func test_announce_word_for_any_shooter() -> void:
	assert_eq(HudModel.announce_word(2, false), "DOUBLE KILL")
	assert_eq(HudModel.announce_word(1, true), "CATALYST", "first blood")
	assert_eq(HudModel.announce_word(4, false), "", "no banner between tiers")
	assert_eq(HudModel.announce_word(0, false), "", "no streak, no banner")
