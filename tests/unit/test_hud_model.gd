extends GutTest

func test_banner_only_for_human_shooter() -> void:
	assert_eq(HudModel.banner_for(false, 5, false), "", "no banner for the bot's frags")
	assert_eq(HudModel.banner_for(true, 2, false), "DOUBLE KILL")
	assert_eq(HudModel.banner_for(true, 1, true), "CATALYST", "first blood")
	assert_eq(HudModel.banner_for(true, 4, false), "", "no banner between tiers")
