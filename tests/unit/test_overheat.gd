extends GutTest

func test_bounty_by_victim_streak() -> void:
	assert_eq(Overheat.bounty_frags(0), 1, "normal kill = 1")
	assert_eq(Overheat.bounty_frags(Streak.STREAK_TRIPLE), 2, "breaking triple = 2")
	assert_eq(Overheat.bounty_frags(Streak.STREAK_SINGULARITY), 3, "breaking singularity = 3")

func test_break_resets_cooldowns_from_triple() -> void:
	assert_false(Overheat.break_resets_cooldowns(2))
	assert_true(Overheat.break_resets_cooldowns(Streak.STREAK_TRIPLE))

func test_overheat_mods_scale_with_streak() -> void:
	assert_eq(Overheat.overheat_mods(0)["speed"], 1.0)
	assert_gt(Overheat.overheat_mods(Streak.STREAK_SINGULARITY)["speed"], 1.0)
	assert_true(Overheat.overheat_mods(Streak.STREAK_SINGULARITY)["see_through"])

func test_streak_dots_capped() -> void:
	assert_eq(Overheat.streak_dots(50), Overheat.DOT_CAP)
