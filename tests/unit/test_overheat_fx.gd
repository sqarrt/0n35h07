extends GutTest
## OVERHEAT vignette parity with web OverheatVignette.tsx / theme.css: tier table, bolt layout and zigzag, ov-pulse and
## ov-strike keyframes.

const EPS := 0.001
const BOLT_LENGTH := 40.0
const SCREEN := Vector2(1280.0, 720.0)

func _const(value: float) -> Callable:
	return func() -> float: return value

func test_a_straight_roll_subdivides_without_forks() -> void:
	var segments := OverheatFx.bolt_segments(BOLT_LENGTH, _const(0.5))
	assert_eq(segments.size(), 8, "displacement 8 -> 4 -> 2 halves three times")
	assert_eq(segments[0]["from"], Vector2(0.0, OverheatFx.BOX_HEIGHT * 0.5))
	assert_eq(segments.back()["to"], Vector2(BOLT_LENGTH, OverheatFx.BOX_HEIGHT * 0.5), "no end jitter at 0.5")
	assert_true(segments.all(func(s: Dictionary) -> bool: return s["width"] == OverheatFx.STROKE_WIDTH))

func test_low_rolls_fork_twice_at_most() -> void:
	var widths := {}
	for s in OverheatFx.bolt_segments(BOLT_LENGTH, _const(0.0)):
		widths[s["width"]] = true
	assert_true(widths.has(OverheatFx.STROKE_WIDTH * 0.5), "a fork at half width")
	assert_true(widths.has(OverheatFx.STROKE_WIDTH * 0.25), "a fork of a fork")
	assert_false(widths.has(OverheatFx.STROKE_WIDTH * 0.125), "0.375 is too thin to fork again")

func test_layout_places_bolts_down_both_edges() -> void:
	var bolts := OverheatFx.layout("triple", _const(0.5))
	assert_eq(bolts.size(), 12, "six per side")
	assert_eq(bolts[0]["side"], OverheatFx.SIDE_LEFT)
	assert_eq(bolts[6]["side"], OverheatFx.SIDE_RIGHT)
	assert_almost_eq(bolts[0]["top_pct"], 100.0 / 12.0, EPS, "(i + 0.5) / n with no jitter")
	assert_almost_eq(bolts[0]["dur_s"], (5.7 + 7.8) * 0.5, EPS)
	assert_almost_eq(bolts[0]["delay_s"], bolts[0]["dur_s"] * 0.5, EPS)
	var clamped := OverheatFx.layout("singularity", _const(0.0))
	assert_almost_eq(clamped[0]["top_pct"], OverheatFx.POS_MIN_PCT, EPS, "clamped to 4%")

func test_right_bolts_mirror_against_the_edge() -> void:
	var left := {"side": OverheatFx.SIDE_LEFT, "top_pct": 50.0}
	var right := {"side": OverheatFx.SIDE_RIGHT, "top_pct": 50.0}
	assert_eq(OverheatFx.to_screen(left, Vector2(10.0, 17.0), SCREEN), Vector2(8.0, 360.0))
	assert_eq(OverheatFx.to_screen(right, Vector2(10.0, 17.0), SCREEN), Vector2(1272.0, 360.0))

func test_strike_and_pulse_keyframes() -> void:
	const DUR := 10.0
	const DELAY := 2.0
	assert_eq(OverheatFx.strike_opacity(1.0, DUR, DELAY), 0.0, "waiting for its delay")
	assert_almost_eq(OverheatFx.strike_opacity(DELAY + 0.4, DUR, DELAY), 1.0, EPS, "4%: full")
	assert_almost_eq(OverheatFx.strike_opacity(DELAY + 0.8, DUR, DELAY), 0.2, EPS, "8%: dim")
	assert_almost_eq(OverheatFx.strike_opacity(DELAY + 5.0, DUR, DELAY), 0.0, EPS, "dark after 17%")
	assert_almost_eq(OverheatFx.pulse_opacity(0.0, 2.4), 0.8, EPS)
	assert_almost_eq(OverheatFx.pulse_opacity(1.2, 2.4), 1.0, EPS)
	var shadow := OverheatFx.vignette_shadow("singularity")
	assert_almost_eq(shadow["spread_px"], 78.0 * 0.28, EPS)
	assert_almost_eq((shadow["color"] as Color).a, 0.14, EPS)
