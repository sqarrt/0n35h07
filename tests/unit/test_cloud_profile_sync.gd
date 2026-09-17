extends GutTest
## CloudProfileSync — port of web tests/unit/cloudProfile.test.ts: the v1 blob, last-write-wins against the local stamp,
## the profile bound to the Steam account, and the same-day radio trial kept at its highest on adopt.

const PROFILE := {"name": "CLOUD"}
const LOCAL := {"name": "LOCAL"}
const USER := "76561198000000001"
const OTHER_USER := "76561198000000002"
const DAY := "2026-09-14"
const OTHER_DAY := "2026-09-13"

func _blob(updated_at: float) -> Dictionary:
	return {"v": CloudProfileSync.BLOB_VERSION, "updatedAt": updated_at, "profile": PROFILE}

func test_parses_a_valid_blob() -> void:
	var raw := JSON.stringify(_blob(1000.0))
	var blob := CloudProfileSync.parse_blob(raw)
	assert_eq(blob["updatedAt"], 1000.0)
	assert_eq(blob["profile"], PROFILE)

func test_rejects_missing_garbage_and_wrong_versions() -> void:
	for raw in [null, "", "not json", JSON.stringify({"v": 2, "updatedAt": 1, "profile": {}}),
			JSON.stringify({"v": 1, "profile": {}}), JSON.stringify({"v": 1, "updatedAt": 1}),
			JSON.stringify({"v": 1, "updatedAt": "1", "profile": {}})]:
		assert_eq(CloudProfileSync.parse_blob(raw), {}, "rejects %s" % str(raw))

func test_last_write_wins() -> void:
	assert_eq(CloudProfileSync.decide({}, 5.0)["kind"], CloudProfileSync.KIND_PUSH, "no cloud: push local up")
	var adopt := CloudProfileSync.decide(_blob(10.0), 5.0)
	assert_eq(adopt["kind"], CloudProfileSync.KIND_ADOPT, "cloud newer")
	assert_eq(adopt["profile"], PROFILE)
	assert_eq(adopt["updatedAt"], 10.0)
	assert_eq(CloudProfileSync.decide(_blob(1.0), 5.0)["kind"], CloudProfileSync.KIND_PUSH, "local newer")
	assert_eq(CloudProfileSync.decide(_blob(5.0), 5.0)["kind"], CloudProfileSync.KIND_NOOP, "in sync")

func test_steam_unknown_or_an_untagged_profile_keeps_last_write_wins() -> void:
	assert_eq(CloudProfileSync.decide_for_user({}, 5.0, "", "", true)["kind"], CloudProfileSync.KIND_PUSH,
		"Steam unavailable")
	assert_eq(CloudProfileSync.decide_for_user(_blob(1.0), 5.0, "", USER, true)["kind"], CloudProfileSync.KIND_PUSH,
		"an upgrade: the untagged local profile is not reset")

func test_a_fresh_install_starts_fresh_or_adopts() -> void:
	assert_eq(CloudProfileSync.decide_for_user({}, 0.0, "", USER, false)["kind"], CloudProfileSync.KIND_FRESH)
	assert_eq(CloudProfileSync.decide_for_user(_blob(1.0), 0.0, "", USER, false)["kind"], CloudProfileSync.KIND_ADOPT)

func test_our_account_keeps_last_write_wins() -> void:
	assert_eq(CloudProfileSync.decide_for_user(_blob(1.0), 5.0, USER, USER, true)["kind"], CloudProfileSync.KIND_PUSH)

func test_another_account_ignores_the_local_profile() -> void:
	var adopt := CloudProfileSync.decide_for_user(_blob(1.0), 5.0, OTHER_USER, USER, true)
	assert_eq(adopt["kind"], CloudProfileSync.KIND_ADOPT, "the older cloud of this account still wins")
	assert_eq(CloudProfileSync.decide_for_user({}, 5.0, OTHER_USER, USER, true)["kind"], CloudProfileSync.KIND_FRESH)

func test_a_blob_holds_the_profile_and_its_stamp() -> void:
	var blob := CloudProfileSync.parse_blob(CloudProfileSync.blob_json(LOCAL, 42.0))
	assert_eq(blob["profile"], LOCAL)
	assert_eq(blob["updatedAt"], 42.0)

func test_the_same_day_trial_keeps_its_highest_counts() -> void:
	var adopted := {"name": "CLOUD", "radioTrial": {"day": DAY, "gens": 1, "saves": 3}}
	var local := {"name": "LOCAL", "radioTrial": {"day": DAY, "gens": 2, "saves": 0}}
	var merged := CloudProfileSync.merge_same_day_trial(adopted, local)
	assert_eq(merged["radioTrial"], {"day": DAY, "gens": 2, "saves": 3})
	assert_eq(merged["name"], "CLOUD")

func test_another_day_or_no_trial_keeps_the_adopted_profile() -> void:
	var adopted := {"name": "CLOUD", "radioTrial": {"day": DAY, "gens": 1, "saves": 1}}
	assert_eq(CloudProfileSync.merge_same_day_trial(adopted,
		{"radioTrial": {"day": OTHER_DAY, "gens": 9, "saves": 9}}), adopted)
	assert_eq(CloudProfileSync.merge_same_day_trial(adopted, {"name": "LOCAL"}), adopted)
	assert_eq(CloudProfileSync.merge_same_day_trial({"name": "CLOUD"}, adopted), {"name": "CLOUD"})

func test_the_first_run_name_is_the_trimmed_steam_name() -> void:
	assert_eq(CloudProfileSync.first_run_name(true, "  Alice ", "RX-1"), "Alice")
	assert_eq(CloudProfileSync.first_run_name(true, "   ", "RX-1"), "RX-1", "a blank Steam name keeps the fallback")
	assert_eq(CloudProfileSync.first_run_name(false, "Alice", "RX-1"), "RX-1", "an existing profile keeps its name")
