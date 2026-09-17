extends GutTest
## HUD match timer text parity with web MatchHud fmt: MM:SS, zero-padded.

const SECONDS_PER_MIN := 60
const FIVE_MIN_S := 5 * SECONDS_PER_MIN
const TEN_MIN_S := 10 * SECONDS_PER_MIN

func test_formats_minutes_and_seconds_zero_padded() -> void:
	assert_eq(HudModel.match_time(0), "00:00")
	assert_eq(HudModel.match_time(FIVE_MIN_S - 1), "04:59")
	assert_eq(HudModel.match_time(TEN_MIN_S), "10:00")

func test_unknown_time_shows_dashes_and_negative_clamps() -> void:
	assert_eq(HudModel.match_time(null), "--:--", "no clock yet (web fmt(null))")
	assert_eq(HudModel.match_time(-FIVE_MIN_S), "00:00", "web Math.max(0, sec)")
