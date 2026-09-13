class_name StreakFx
## Kill-streak text effects — port of web EffectText.tsx + theme.css `.fx` rules (the streak banner and the HUD name):
## the per-kind style table, the CSS @keyframes replayed through CssTiming, and the SINGULARITY character scramble.
## Pure data and sampling; the EffectText node renders it.

const COLOR_PLAYER := "player"     # text takes the shooter's colour (web color: var(--pc))
const COLOR_FIXED := "fixed"
const ANIM_FLICK := "flick"        # DOUBLE  — ks-flick
const ANIM_JITTER := "jitter"      # TRIPLE  — ks-jitter
const ANIM_BURN := "burn"          # SINGULARITY — ks-burn
const ANIM_THROB := "throb"        # CATALYST — ks-throb (glow radius)
const TIER_ARCS := 3               # web: tiers render three .arc sparks
const CATALYST_ARCS := 5           # catalyst adds two sparks and three .tick marks
const CATALYST_TICKS := 3
const SCRAMBLE_CHARS := "#@%&$/\\|<>*+="
const SCRAMBLE_CHANCE := 0.4
const SCRAMBLE_MS := 240.0
const SCRAMBLE_FLASH_MS := 90.0

const STYLES := {
	"double": {"color_rule": COLOR_PLAYER, "color": Color.WHITE, "glitch": true, "glitch_periods_s": [2.1, 2.5],
		"anim": ANIM_FLICK, "anim_period_s": 2.4, "arcs": TIER_ARCS, "ticks": 0, "scramble": false},
	"triple": {"color_rule": COLOR_FIXED, "color": Color("#eaf4ff"), "glitch": true, "glitch_periods_s": [1.2, 1.0],
		"anim": ANIM_JITTER, "anim_period_s": 0.18, "arcs": TIER_ARCS, "ticks": 0, "scramble": false},
	"singularity": {"color_rule": COLOR_FIXED, "color": Color.WHITE, "glitch": true, "glitch_periods_s": [0.55, 0.5],
		"anim": ANIM_BURN, "anim_period_s": 0.9, "arcs": TIER_ARCS, "ticks": 0, "scramble": true},
	"catalyst": {"color_rule": COLOR_FIXED, "color": Color.WHITE, "glitch": false, "glitch_periods_s": [],
		"anim": ANIM_THROB, "anim_period_s": 0.8, "arcs": CATALYST_ARCS, "ticks": CATALYST_TICKS, "scramble": false},
}

# ks-flick: opacity dips at 50% and 80%.
const FLICK_KEYS := [[0.0, 1.0], [0.5, 0.85], [0.51, 1.0], [0.79, 1.0], [0.8, 0.55], [0.82, 1.0], [1.0, 1.0]]
const FLICK_PERIOD_S := 2.4
# ks-jitter: sub-pixel shake.
const JITTER_KEYS := [[0.0, Vector2(0, 0)], [0.25, Vector2(0.6, -0.4)], [0.5, Vector2(-0.5, 0.5)], [0.75, Vector2(0.4, 0.3)], [1.0, Vector2(0, 0)]]
const JITTER_PERIOD_S := 0.18
# ks-burn: shake plus a 3% swell at 40% (keyframes without scale() are scale 1).
const BURN_OFFSET_KEYS := [[0.0, Vector2(0, 0)], [0.2, Vector2(1, -0.6)], [0.4, Vector2(-1, 0.6)], [0.6, Vector2(0.8, 0.5)], [0.8, Vector2(-0.6, -0.5)], [1.0, Vector2(0, 0)]]
const BURN_SCALE_KEYS := [[0.0, 1.0], [0.2, 1.0], [0.4, 1.03], [0.6, 1.0], [0.8, 1.0], [1.0, 1.0]]
const BURN_PERIOD_S := 0.9
# ks-throb (ease-in-out): the player-colour glow radius of CATALYST text.
const THROB_KEYS := [[0.0, 8.0], [0.5, 18.0], [1.0, 8.0]]
const THROB_PERIOD_S := 0.8
# ks-crack / ks-tick: brief flashes of the sparks and tick marks.
const CRACK_KEYS := [[0.0, 0.0], [0.48, 0.0], [0.5, 1.0], [0.54, 0.0], [1.0, 0.0]]
const TICK_KEYS := [[0.0, 0.0], [0.7, 0.0], [0.73, 1.0], [0.77, 0.0], [1.0, 0.0]]
# ks-gA / ks-gB glitch bands: Vector3(clip top, clip bottom, x shift px), played with steps(2).
const GLITCH_A_KEYS := [[0.0, Vector3(0.0, 0.85, 0)], [0.2, Vector3(0.2, 0.55, -2)], [0.4, Vector3(0.6, 0.1, 2)], [0.6, Vector3(0.1, 0.7, -1)], [1.0, Vector3(0.0, 0.85, 0)]]
const GLITCH_B_KEYS := [[0.0, Vector3(0.7, 0.05, 0)], [0.25, Vector3(0.35, 0.4, 2)], [0.55, Vector3(0.05, 0.8, -2)], [1.0, Vector3(0.7, 0.05, 0)]]
const GLITCH_STEPS := 2

## The style for a streak kind ("double" / "triple" / "singularity" / "catalyst"); {} for plain text.
static func style(kind: String) -> Dictionary:
	return (STYLES[kind] as Dictionary).duplicate(true) if STYLES.has(kind) else {}

static func flick_opacity(time_s: float) -> float:
	return CssTiming.sample(FLICK_KEYS, CssTiming.cycle_fraction(time_s, FLICK_PERIOD_S), CssTiming.EASE)

static func jitter_offset(time_s: float) -> Vector2:
	return CssTiming.sample(JITTER_KEYS, CssTiming.cycle_fraction(time_s, JITTER_PERIOD_S), CssTiming.EASE)

static func burn_transform(time_s: float) -> Dictionary:
	var f := CssTiming.cycle_fraction(time_s, BURN_PERIOD_S)
	return {"offset": CssTiming.sample(BURN_OFFSET_KEYS, f, CssTiming.EASE),
		"scale": CssTiming.sample(BURN_SCALE_KEYS, f, CssTiming.EASE)}

static func throb_glow_px(time_s: float) -> float:
	return CssTiming.sample(THROB_KEYS, CssTiming.cycle_fraction(time_s, THROB_PERIOD_S), CssTiming.EASE_IN_OUT)

## Spark opacity for a spark with its own period and delay (hidden until the delay elapses, like CSS without fill).
static func crack_opacity(time_s: float, period_s: float, delay_s: float) -> float:
	var f := CssTiming.cycle_fraction(time_s, period_s, delay_s)
	return 0.0 if f < 0.0 else CssTiming.sample(CRACK_KEYS, f, CssTiming.EASE)

static func tick_opacity(time_s: float, period_s: float, delay_s: float) -> float:
	var f := CssTiming.cycle_fraction(time_s, period_s, delay_s)
	return 0.0 if f < 0.0 else CssTiming.sample(TICK_KEYS, f, CssTiming.EASE)

## Visible band of glitch copy A: {"top", "bottom"} clip fractions and "shift_px".
static func glitch_band_a(time_s: float, period_s: float) -> Dictionary:
	return _band(CssTiming.sample_steps(GLITCH_A_KEYS, CssTiming.cycle_fraction(time_s, period_s), GLITCH_STEPS))

static func glitch_band_b(time_s: float, period_s: float) -> Dictionary:
	return _band(CssTiming.sample_steps(GLITCH_B_KEYS, CssTiming.cycle_fraction(time_s, period_s), GLITCH_STEPS))

static func _band(v: Vector3) -> Dictionary:
	return {"top": v.x, "bottom": v.y, "shift_px": v.z}

## SINGULARITY scramble, same random calls as the web: per letter/digit a chance roll, then a pick on a hit.
static func scramble(text: String, rng: Callable) -> String:
	var out := ""
	for c in text:
		if _is_alnum(c) and rng.call() < SCRAMBLE_CHANCE:
			out += SCRAMBLE_CHARS[floori(rng.call() * SCRAMBLE_CHARS.length())]
		else:
			out += c
	return out

static func _is_alnum(c: String) -> bool:
	return (c >= "A" and c <= "Z") or (c >= "a" and c <= "z") or (c >= "0" and c <= "9")
