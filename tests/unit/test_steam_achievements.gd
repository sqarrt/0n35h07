extends GutTest
## SteamAchievements — port of web tests/unit/achievements.test.ts: the local player's events map to the Steamworks API
## names (first blood, streak tiers, a perfect block, a win and a flawless win) and a repeat trigger unlocks once.

const STREAK_PLAIN := 1
const STREAK_DOUBLE := 2
const STREAK_TRIPLE := 3
const STREAK_SINGULARITY := 5

var _unlocked: Array = []

func _achievements() -> SteamAchievements:
	_unlocked = []
	return SteamAchievements.new(func(api_name: String) -> void: _unlocked.append(api_name))

func test_first_blood_is_catalyst() -> void:
	var achievements := _achievements()
	achievements.on_kill(STREAK_PLAIN, true)
	assert_eq(_unlocked, [SteamAchievements.ACH_CATALYST])

func test_streak_thresholds() -> void:
	var achievements := _achievements()
	achievements.on_kill(STREAK_DOUBLE, false)
	achievements.on_kill(STREAK_TRIPLE, false)
	achievements.on_kill(STREAK_SINGULARITY, false)
	assert_eq(_unlocked, [SteamAchievements.ACH_DOUBLE_KILL, SteamAchievements.ACH_TRIPLE_KILL,
		SteamAchievements.ACH_SINGULARITY])

func test_a_plain_kill_unlocks_nothing() -> void:
	var achievements := _achievements()
	achievements.on_kill(STREAK_PLAIN, false)
	assert_eq(_unlocked, [])

func test_a_perfect_block_is_deflector() -> void:
	var achievements := _achievements()
	achievements.on_perfect_block()
	assert_eq(_unlocked, [SteamAchievements.ACH_DEFLECTOR])

func test_a_win_and_a_flawless_win() -> void:
	var achievements := _achievements()
	achievements.on_match_end(true, false)
	assert_eq(_unlocked, [SteamAchievements.ACH_FIRST_WIN])
	var flawless := _achievements()
	flawless.on_match_end(true, true)
	assert_eq(_unlocked, [SteamAchievements.ACH_FIRST_WIN, SteamAchievements.ACH_UNTOUCHABLE])

func test_a_loss_unlocks_nothing() -> void:
	var achievements := _achievements()
	achievements.on_match_end(false, true)
	assert_eq(_unlocked, [])

func test_repeat_triggers_unlock_once() -> void:
	var achievements := _achievements()
	achievements.on_kill(STREAK_PLAIN, true)
	achievements.on_kill(STREAK_PLAIN, true)
	achievements.on_perfect_block()
	achievements.on_perfect_block()
	assert_eq(_unlocked, [SteamAchievements.ACH_CATALYST, SteamAchievements.ACH_DEFLECTOR])
