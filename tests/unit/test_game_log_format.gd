extends GutTest
## GameLogFormat — port of web tests/unit/logFormat.test.ts: greppable `key=value` fields, the single-character level,
## no trailing space without fields, and a sortable per-session file name in local time.

const TS := "2026-06-30T00:00:01.000Z"

func test_fields_are_greppable() -> void:
	assert_eq(GameLogFormat.fmt_fields({"id": 1, "hit": 0, "point": [1.25, 1.7, 0], "name": "a b"}),
		"id=1 hit=0 point=[1.25,1.7,0] name=\"a b\"")

func test_whole_floats_round_and_other_values() -> void:
	assert_eq(GameLogFormat.fmt_fields({"ms": 1500.0, "dist": 12.34567, "on": true, "tag": "k=v", "none": null}),
		"ms=1500 dist=12.346 on=true tag=\"k=v\" none=null")
	assert_eq(GameLogFormat.fmt_fields({"obj": {"a": 1}}), "obj={\"a\":1}")

func test_no_trailing_space_without_fields() -> void:
	assert_eq(GameLogFormat.format_line(TS, 1234, GameLogFormat.LEVEL_INFO, "act", "fire"), TS + " +1234 I act fire")

func test_the_level_is_one_character_and_fields_follow() -> void:
	assert_eq(GameLogFormat.format_line(TS, 12, GameLogFormat.LEVEL_WARN, "nego", "duration_fallback",
		{"want": 5, "got": 3}), TS + " +12 W nego duration_fallback want=5 got=3")
	assert_eq(GameLogFormat.format_line(TS, 0, GameLogFormat.LEVEL_ERROR, "life", "uncaught"), TS + " +0 E life uncaught")

func test_a_sortable_session_file_name() -> void:
	var name := GameLogFormat.session_file_name({"year": 2026, "month": 6, "day": 30, "hour": 1, "minute": 22,
		"second": 3})
	assert_eq(name, "oneshot-20260630-012203.log")

func test_an_iso_timestamp_with_milliseconds() -> void:
	assert_eq(GameLogFormat.iso_utc(1782777601.25), "2026-06-30T00:00:01.250Z")
