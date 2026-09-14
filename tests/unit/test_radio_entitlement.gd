extends GutTest
## RadioEntitlement — the free daily trial of web src/radio/entitlement.ts, checked against that module's own answers
## (web-reference/scripts/export-radio-entitlement.mjs): the day key, a new day resetting the counters, a clock wound
## back keeping them, the caps, DLC ownership and dev runs unlimited.

const FIXTURE := "res://tests/fixtures/radio_entitlement.json"
const WEB_INFINITY := "Infinity"
const DATE := {"year": 2026, "month": 6, "day": 8}

var _web: Dictionary

func before_all() -> void:
	_web = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE))

func test_the_caps_are_the_webs() -> void:
	assert_eq(RadioEntitlement.FREE_GENS_PER_DAY, int(_web["freeGensPerDay"]))
	assert_eq(RadioEntitlement.FREE_SAVES_PER_DAY, int(_web["freeSavesPerDay"]))

func test_the_day_key_pads_month_and_day() -> void:
	assert_eq(RadioEntitlement.today_key(DATE), "2026-06-08")
	for case in _web["today"]:
		assert_eq(RadioEntitlement.empty_trial(case["key"]), _trial(case["empty"]))

func test_rolling_matches_the_web() -> void:
	for case in _web["roll"]:
		var trial = _trial(case["trial"]) if case["trial"] != null else null
		assert_eq(RadioEntitlement.roll_trial(trial, case["today"]), _trial(case["out"]), str(case))

func test_consuming_matches_the_web() -> void:
	for case in _web["consume"]:
		var out := RadioEntitlement.consume_gen(_trial(case["trial"]), case["today"]) if case["kind"] == "gen" \
			else RadioEntitlement.consume_save(_trial(case["trial"]), case["today"])
		assert_eq(out, _trial(case["out"]), str(case))

func test_entitlement_matches_the_web() -> void:
	for case in _web["entitlement"]:
		var got := RadioEntitlement.entitlement_for(case["owned"], case["devUnlimited"], _trial(case["trial"]))
		var want: Dictionary = case["out"]
		assert_eq(got["unlimited"], want["unlimited"], str(case))
		assert_eq(got["gens_left"], _count(want["gensLeft"]), str(case))
		assert_eq(got["saves_left"], _count(want["savesLeft"]), str(case))
		assert_eq(got["can_generate"], want["canGenerate"], str(case))
		assert_eq(got["can_save"], want["canSave"], str(case))

func test_rolling_does_not_touch_the_stored_trial() -> void:
	var stored := {"day": "2026-06-27", "gens": 9, "saves": 4}
	RadioEntitlement.consume_gen(stored, "2026-06-28")
	assert_eq(stored, {"day": "2026-06-27", "gens": 9, "saves": 4}, "web returns a new object")

## JSON numbers arrive as floats; the port keeps whole counts.
func _trial(web: Dictionary) -> Dictionary:
	return {"day": web["day"], "gens": int(web["gens"]), "saves": int(web["saves"])}

func _count(web: Variant) -> float:
	return INF if web is String and web == WEB_INFINITY else float(web)
