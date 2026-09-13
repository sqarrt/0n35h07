class_name StreakFx
## Kill-streak text effects — port of web EffectText.tsx + theme.css `.fx` rules (the streak banner and the HUD name):
## the per-kind style table, text-shadow lists, the SVG turbulence filters ks-el1..3, spark / tick layout, the CSS
## @keyframes replayed through CssTiming, and the SINGULARITY character scramble. Pure data and sampling; the
## EffectText node renders it.

const COLOR_PLAYER := "player"     # text takes the shooter's colour (web color: var(--pc))
const COLOR_FIXED := "fixed"
const PC := "pc"                   # a shadow colour slot filled with the player colour
const ANIM_FLICK := "flick"        # DOUBLE  — ks-flick
const ANIM_JITTER := "jitter"      # TRIPLE  — ks-jitter
const ANIM_BURN := "burn"          # SINGULARITY — ks-burn
const ANIM_THROB := "throb"        # CATALYST — ks-throb (animated text-shadow)
const TIER_ARCS := 3               # web: tiers render three .arc sparks
const CATALYST_ARCS := 5           # catalyst adds two sparks and three .tick marks
const CATALYST_TICKS := 3
const SCRAMBLE_CHARS := "#@%&$/\\|<>*+="
const SCRAMBLE_CHANCE := 0.4
const SCRAMBLE_MS := 240.0
const SCRAMBLE_FLASH_MS := 90.0

# Shadows are [blur px, colour (PC = player colour), optional alpha multiplier]; filters mirror <filter id="ks-elN">
# (feTurbulence fractalNoise baseFrequency animated from -> to -> from over period_s, feDisplacementMap scale).
const STYLES := {
	"double": {"color_rule": COLOR_PLAYER, "color": Color.WHITE, "glitch": true, "glitch_periods_s": [2.1, 2.5],
		"anim": ANIM_FLICK, "anim_period_s": 2.4, "arcs": TIER_ARCS, "ticks": 0, "scramble": false,
		"shadows": [[12.0, PC]],
		"filter": {"freq_from": Vector2(0.0, 0.9), "freq_to": Vector2(0.0, 0.55), "period_s": 3.0, "octaves": 2,
			"seed": 7, "scale": 3.0}},
	"triple": {"color_rule": COLOR_FIXED, "color": Color("#eaf4ff"), "glitch": true, "glitch_periods_s": [1.2, 1.0],
		"anim": ANIM_JITTER, "anim_period_s": 0.18, "arcs": TIER_ARCS, "ticks": 0, "scramble": false,
		"shadows": [[14.0, PC], [2.0, Color.WHITE]],
		"filter": {"freq_from": Vector2(0.02, 0.8), "freq_to": Vector2(0.03, 0.4), "period_s": 1.4, "octaves": 2,
			"seed": 3, "scale": 5.0}},
	"singularity": {"color_rule": COLOR_FIXED, "color": Color.WHITE, "glitch": true, "glitch_periods_s": [0.55, 0.5],
		"anim": ANIM_BURN, "anim_period_s": 0.9, "arcs": TIER_ARCS, "ticks": 0, "scramble": true,
		"shadows": [[6.0, Color.WHITE], [18.0, PC], [32.0, PC]],
		"filter": {"freq_from": Vector2(0.03, 0.7), "freq_to": Vector2(0.06, 0.3), "period_s": 0.8, "octaves": 3,
			"seed": 11, "scale": 8.0}},
	"catalyst": {"color_rule": COLOR_FIXED, "color": Color.WHITE, "glitch": false, "glitch_periods_s": [],
		"anim": ANIM_THROB, "anim_period_s": 0.8, "arcs": CATALYST_ARCS, "ticks": CATALYST_TICKS, "scramble": false,
		"shadows": [], "filter": {}},
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
# ks-throb (ease-in-out): 0%/100% and 50% text-shadow lists of CATALYST (50% adds color-mix(--pc 60%, transparent)).
const THROB_REST := [[8.0, PC], [2.0, Color.WHITE]]
const THROB_PEAK := [[18.0, PC], [6.0, Color.WHITE], [30.0, PC, 0.6]]
const THROB_PERIOD_S := 0.8
const THROB_PEAK_AT := 0.5
# ks-crack / ks-tick: brief flashes of the sparks and tick marks.
const CRACK_KEYS := [[0.0, 0.0], [0.48, 0.0], [0.5, 1.0], [0.54, 0.0], [1.0, 0.0]]
const TICK_KEYS := [[0.0, 0.0], [0.7, 0.0], [0.73, 1.0], [0.77, 0.0], [1.0, 0.0]]
# ks-gA / ks-gB glitch bands: Vector3(clip top, clip bottom, x shift px), played with steps(2).
const GLITCH_A_KEYS := [[0.0, Vector3(0.0, 0.85, 0)], [0.2, Vector3(0.2, 0.55, -2)], [0.4, Vector3(0.6, 0.1, 2)], [0.6, Vector3(0.1, 0.7, -1)], [1.0, Vector3(0.0, 0.85, 0)]]
const GLITCH_B_KEYS := [[0.0, Vector3(0.7, 0.05, 0)], [0.25, Vector3(0.35, 0.4, 2)], [0.55, Vector3(0.05, 0.8, -2)], [1.0, Vector3(0.7, 0.05, 0)]]
const GLITCH_STEPS := 2
const FILTER_MIDPOINT := 0.5       # SMIL values="from;to;from": `to` at half the period

# web ARC / TICK tables: top as a share of the box height; left / right in px or as a share of the box width.
const ARCS := [
	{"top": 0.2, "left": -12.0, "width": 20.0, "angle_deg": 20.0, "period_s": 0.5, "delay_s": 0.0},
	{"top": 0.8, "right": -12.0, "width": 20.0, "angle_deg": -18.0, "period_s": 0.45, "delay_s": 0.12},
	{"top": 0.08, "right_share": 0.2, "width": 14.0, "angle_deg": 36.0, "period_s": 0.55, "delay_s": 0.22},
	{"top": 0.55, "left": -14.0, "width": 16.0, "angle_deg": -10.0, "period_s": 0.4, "delay_s": 0.3},
	{"top": 0.35, "right": -12.0, "width": 18.0, "angle_deg": 12.0, "period_s": 0.5, "delay_s": 0.38},
]
const TICKS := [
	{"top": 0.64, "left_share": 0.14, "period_s": 0.5, "delay_s": 0.05},
	{"top": 0.14, "left_share": 0.4, "period_s": 0.6, "delay_s": 0.25},
	{"top": 0.7, "left_share": 0.7, "period_s": 0.55, "delay_s": 0.15},
]
const ARC_HEIGHT_PX := 1.0
const ARC_GLOW_BLUR := 3.0         # .arc filter: drop-shadow(0 0 3px var(--pc))
const TICK_SIZE_PX := Vector2(1.0, 6.0)
const TICK_GLOW_BLUR := 4.0        # .tick box-shadow: 0 0 4px var(--pc)
const ARC_REACH_PX := 24           # sparks stick out of the box by up to ~14 px plus their glow

## The style for a streak kind ("double" / "triple" / "singularity" / "catalyst"); {} for plain text.
static func style(kind: String) -> Dictionary:
	return (STYLES[kind] as Dictionary).duplicate(true) if STYLES.has(kind) else {}

## Text colour of a kind: the player colour or the kind's fixed colour.
static func text_color(kind: String, player_color: Color) -> Color:
	var s := style(kind)
	return player_color if s.get("color_rule", COLOR_FIXED) == COLOR_PLAYER else s.get("color", Color.WHITE)

## The kind's CSS text-shadow list at `time_s` (CssShadow dictionaries, first on top).
static func text_shadows(kind: String, player_color: Color, time_s: float) -> Array:
	var s := style(kind)
	if s.is_empty():
		return []
	if s["anim"] == ANIM_THROB:
		return _throb_shadows(player_color, time_s)
	return _resolve(s["shadows"], player_color)

static func _throb_shadows(player_color: Color, time_s: float) -> Array:
	var rest := _resolve(THROB_REST, player_color)
	var peak := _resolve(THROB_PEAK, player_color)
	var f := CssTiming.cycle_fraction(time_s, THROB_PERIOD_S)
	if f < THROB_PEAK_AT:
		return CssShadow.lerp_lists(rest, peak, CssTiming.cubic_bezier(f / THROB_PEAK_AT, CssTiming.EASE_IN_OUT))
	var t := CssTiming.cubic_bezier((f - THROB_PEAK_AT) / (1.0 - THROB_PEAK_AT), CssTiming.EASE_IN_OUT)
	return CssShadow.lerp_lists(peak, rest, t)

static func _resolve(specs: Array, player_color: Color) -> Array:
	var out := []
	for spec in specs:
		var color: Color = player_color if typeof(spec[1]) == TYPE_STRING else spec[1]
		if spec.size() > 2:
			color.a *= spec[2]
		out.append(CssShadow.make(spec[0], color))
	return out

## The kind's turbulence filter ({} when none): baseFrequency at `time_s` plus octaves / seed / displacement scale.
static func filter_at(kind: String, time_s: float) -> Dictionary:
	var f: Dictionary = style(kind).get("filter", {})
	if f.is_empty():
		return {}
	var phase := CssTiming.cycle_fraction(time_s, f["period_s"])
	var from: Vector2 = f["freq_from"]
	var to: Vector2 = f["freq_to"]
	var frequency := from.lerp(to, phase / FILTER_MIDPOINT) if phase < FILTER_MIDPOINT \
		else to.lerp(from, (phase - FILTER_MIDPOINT) / FILTER_MIDPOINT)
	return {"frequency": frequency, "octaves": f["octaves"], "seed": f["seed"], "scale": f["scale"]}

## Top-left of spark `index`'s unrotated 1 px box inside a text box of `box` size (CSS absolute positioning).
static func arc_position(index: int, box: Vector2) -> Vector2:
	var arc: Dictionary = ARCS[index]
	var x: float
	if arc.has("left"):
		x = arc["left"]
	elif arc.has("right"):
		x = box.x - arc["right"] - arc["width"]
	else:
		x = box.x - box.x * arc["right_share"] - arc["width"]
	return Vector2(x, box.y * arc["top"])

static func tick_position(index: int, box: Vector2) -> Vector2:
	var tick: Dictionary = TICKS[index]
	return Vector2(box.x * tick["left_share"], box.y * tick["top"])

static func flick_opacity(time_s: float) -> float:
	return CssTiming.sample(FLICK_KEYS, CssTiming.cycle_fraction(time_s, FLICK_PERIOD_S), CssTiming.EASE)

static func jitter_offset(time_s: float) -> Vector2:
	return CssTiming.sample(JITTER_KEYS, CssTiming.cycle_fraction(time_s, JITTER_PERIOD_S), CssTiming.EASE)

static func burn_transform(time_s: float) -> Dictionary:
	var f := CssTiming.cycle_fraction(time_s, BURN_PERIOD_S)
	return {"offset": CssTiming.sample(BURN_OFFSET_KEYS, f, CssTiming.EASE),
		"scale": CssTiming.sample(BURN_SCALE_KEYS, f, CssTiming.EASE)}

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
