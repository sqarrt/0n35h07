extends GutTest

func test_deterministic_from_name() -> void:
	var a := BotPersonality.from_name("Reaper")
	var b := BotPersonality.from_name("Reaper")
	assert_eq(a.hit_chance, b.hit_chance)
	assert_eq(a.fire_interval_ms, b.fire_interval_ms)
	assert_eq(a.skill, b.skill)

func test_traits_within_anchor_ranges() -> void:
	var p := BotPersonality.from_name("Someone")
	assert_between(p.hit_chance, 0.40, 0.798, "hit_chance in anchor range")
	assert_between(p.fire_interval_ms, 1400.0, 2800.0, "fire interval in range")
	assert_between(p.skill, 0.0, 1.0, "skill in [0,1]")

func test_offense_increases_with_skill() -> void:
	assert_gt(BotPersonality.offense_at(1.0), BotPersonality.offense_at(0.0), "stronger skill = more offense")
