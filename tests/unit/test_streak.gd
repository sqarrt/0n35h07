extends GutTest

func test_tier_thresholds() -> void:
	assert_eq(Streak.streak_tier(1), "")
	assert_eq(Streak.streak_tier(2), "double")
	assert_eq(Streak.streak_tier(3), "triple")
	assert_eq(Streak.streak_tier(5), "singularity")

func test_announce_first_blood_is_catalyst() -> void:
	assert_eq(Streak.announce_kind(1, true), "catalyst")

func test_announce_only_on_exact_tier() -> void:
	assert_eq(Streak.announce_kind(2, false), "double")
	assert_eq(Streak.announce_kind(4, false), "", "no banner between tiers")
	assert_eq(Streak.announce_kind(5, false), "singularity")

func test_tier_word() -> void:
	assert_eq(Streak.tier_word("catalyst"), "CATALYST")
	assert_eq(Streak.tier_word("singularity"), "SINGULARITY")
