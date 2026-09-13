extends GutTest
## Player identity parity with web names.ts, settings.ts (randomProfile / sanitize / loadProfile), botAppearance.ts and
## the roster entries RoomSession builds: same random-call order, same seeded bot looks, same validation rules.

const LOW := 0.0
const HIGH := 0.99
const TEST_PATH := "user://test_profile.json"
const EPS := 0.0001

func _const(value: float) -> Callable:
	return func() -> float: return value

func after_each() -> void:
	if FileAccess.file_exists(TEST_PATH):
		DirAccess.remove_absolute(TEST_PATH)

func test_model_names_follow_the_web_random_calls() -> void:
	assert_eq(ModelNames.generate(_const(LOW)), "RA-1", "first prefix, one digit 1, dash roll hit")
	assert_eq(ModelNames.generate(_const(HIGH)), "Z9999Z", "last prefix, four 9s, no dash, suffix Z")
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 50:
		assert_true(ModelNames.is_model_name(ModelNames.generate(rng.randf)), "web MODEL_NAME_RE")

func test_bot_name_uses_the_hosts_name_or_generates_one() -> void:
	assert_eq(ModelNames.bot_name("  EX82R ", _const(LOW)), "EX82R")
	assert_eq(ModelNames.bot_name("   ", _const(LOW)), "RA-1", "empty field -> generated model name")

func test_random_profile_matches_web_defaults() -> void:
	var p := PlayerProfile.random(_const(LOW))
	assert_eq(p["name"], "RA-1")
	assert_eq([p["primaryColor"], p["reserveColor"]], ["#4af", "#fa4"], "reserve drawn from the rest of the palette")
	assert_eq(p["defaultView"], "fp")
	assert_eq([p["ballModel"], p["windupStyle"], p["respawnStyle"], p["dashStyle"], p["shieldStyle"]],
		["smooth", "classic", "echo", "streak", "dome"])
	assert_true(p["audioViz"])
	assert_false(p["showFps"])
	assert_almost_eq(p["volumeMusic"], 0.3, EPS)
	assert_eq(p["connectTimeoutSec"], 10)

func test_sanitize_repairs_bad_data_like_the_web() -> void:
	var p := PlayerProfile.sanitize({"name": "   ABCDEFGHIJKLMNOPQRST  ", "primaryColor": "#123",
		"reserveColor": "#4af", "defaultView": "tp", "ballModel": "cube", "volumeSfx": 3,
		"connectTimeoutSec": 30.0, "locale": "ru", "ballArt": "nope", "radioTrial": {"day": "d", "gens": 2.7, "saves": 1}},
		_const(LOW))
	assert_eq(p["name"], "ABCDEFGHIJKLMNOP", "trimmed to 16")
	assert_eq(p["primaryColor"], "#4af", "unknown colour -> palette[0]")
	assert_eq(p["reserveColor"], "#fa4", "reserve equal to primary -> first other colour")
	assert_eq(p["defaultView"], "tp")
	assert_eq(p["ballModel"], "smooth")
	assert_almost_eq(p["volumeSfx"], 1.0, EPS, "clamped")
	assert_eq(p["connectTimeoutSec"], 30)
	assert_eq(p["locale"], "ru")
	assert_false(p.has("ballArt"), "invalid artwork is dropped")
	assert_eq(p["radioTrial"], {"day": "d", "gens": 2, "saves": 1})
	assert_eq(PlayerProfile.sanitize({}, _const(LOW))["name"], "RA-1", "missing name -> generated")

func test_ball_art_validation() -> void:
	var art := Marshalls.raw_to_base64(PackedByteArray(range(AppearanceConst.BALL_ART_BYTES)))
	assert_true(PlayerProfile.is_valid_ball_art(art))
	assert_false(PlayerProfile.is_valid_ball_art(art.substr(1)))

func test_bot_look_is_seeded_by_name_like_the_web() -> void:
	# Reference values computed from web botAppearance.ts (djb2 + mulberry32).
	assert_eq(BotAppearance.from_name("EX82R"), {"color": "#fd4", "ballModel": "waves", "windupStyle": "singularity",
		"respawnStyle": "echo", "dashStyle": "streak", "shieldStyle": "hex", "reserveColor": "#f55"})
	assert_eq(BotAppearance.from_name("GTX59555"), {"color": "#4af", "ballModel": "waves",
		"windupStyle": "singularity", "respawnStyle": "swarm", "dashStyle": "rift", "shieldStyle": "dome",
		"reserveColor": "#a4f"})

func test_roster_entries_carry_names_and_colours() -> void:
	var roster := Roster.new()
	var profile := PlayerProfile.random(_const(LOW))
	roster.add(Roster.human_entry(0, profile))
	roster.add(Roster.bot_entry(1, "EX82R", "normal"))
	assert_eq(roster.name_of(0), "RA-1")
	assert_eq(roster.color_of(0), Color("#4af"))
	assert_eq(roster.entry(1)["kind"], Roster.KIND_BOT)
	assert_eq(roster.color_of(1), Color("#fd4"), "bot colour from its name")
	assert_eq(roster.opponent_of(0)["id"], 1)
	assert_eq(roster.color_of(9), Color(AppearanceConst.FALLBACK_TEXT_COLOR), "unknown id -> --text")

func test_profile_store_creates_then_reloads() -> void:
	var created := ProfileStore.load_profile(_const(LOW), TEST_PATH)
	assert_true(FileAccess.file_exists(TEST_PATH), "first run saves right away")
	created["name"] = "PILOT"
	ProfileStore.save_profile(created, _const(LOW), TEST_PATH)
	assert_eq(ProfileStore.load_profile(_const(HIGH), TEST_PATH)["name"], "PILOT")
	var corrupt := FileAccess.open(TEST_PATH, FileAccess.WRITE)
	corrupt.store_string("{not json")
	corrupt.close()
	assert_eq(ProfileStore.load_profile(_const(LOW), TEST_PATH)["name"], "RA-1", "corrupt -> recreated")
