class_name OverheatFx
## OVERHEAT vignette timing and lightning — port of web OverheatVignette.tsx + theme.css (.overheat-vig, .ov-bolt,
## ov-pulse, ov-strike): red inset edges pulsing per streak tier and lightning bolts flickering at the left and right
## screen edges. Bolt shapes use the web midpoint displacement with forks, drawing randoms in the web order.

const TIERS := {
	"double": {"a": 0.05, "r": 40.0, "pulse": 3.2, "per_side": 3, "lmin": 22.0, "lmax": 34.0, "dmin": 7.8, "dmax": 10.2},
	"triple": {"a": 0.085, "r": 58.0, "pulse": 2.4, "per_side": 6, "lmin": 26.0, "lmax": 40.0, "dmin": 5.7, "dmax": 7.8},
	"singularity": {"a": 0.14, "r": 78.0, "pulse": 1.7, "per_side": 10, "lmin": 28.0, "lmax": 46.0, "dmin": 3.6,
		"dmax": 5.7},
}
const GLOW_RGB := Color8(255, 46, 40)          # box-shadow rgba(255,46,40,--a)
const SPREAD_SHARE := 0.28                      # box-shadow spread = --r * 0.28
const PULSE_KEYS := [[0.0, 0.8], [0.5, 1.0], [1.0, 0.8]]                      # ov-pulse, ease-in-out
const STRIKE_KEYS := [[0.0, 0.0], [0.04, 1.0], [0.08, 0.2], [0.12, 0.9], [0.17, 0.0], [1.0, 0.0]]   # ov-strike, ease
const SIDE_LEFT := "l"
const SIDE_RIGHT := "r"
const EDGE_OUTSET_PX := 2.0                     # left: -2px / right: -2px
const BOX_HEIGHT := 34.0                        # the bolt SVG height
const END_JITTER_PX := 5.0
const START_DISP_SHARE := 0.2
const STROKE_WIDTH := 1.5
const MIN_DISP := 2.0
const FORK_MIN_WIDTH := 0.6
const FORK_CHANCE := 0.4
const FORK_ANGLE_MIN := 0.5
const FORK_ANGLE_GAIN := 0.6
const FORK_LENGTH_MIN := 0.4
const FORK_LENGTH_GAIN := 0.35
const FORK_WIDTH_SHARE := 0.5
const POS_JITTER_PCT := 6.0
const POS_MIN_PCT := 4.0
const POS_MAX_PCT := 96.0
const PERCENT := 100.0
const HALF := 0.5
const SPREAD := 2.0

static func has_tier(tier: String) -> bool:
	return TIERS.has(tier)

## Bolts for a tier (web useEffect on the tier): left side first, then right; per bolt the randoms go position,
## period, length, delay, then the shape — {"side", "top_pct", "dur_s", "length", "delay_s", "segments"}.
static func layout(tier: String, rng: Callable) -> Array:
	var cfg: Dictionary = TIERS[tier]
	var bolts := []
	for side in [SIDE_LEFT, SIDE_RIGHT]:
		for i in cfg["per_side"]:
			var top := clampf((i + HALF) / cfg["per_side"] * PERCENT + _between(-POS_JITTER_PCT, POS_JITTER_PCT, rng),
				POS_MIN_PCT, POS_MAX_PCT)
			var dur := _between(cfg["dmin"], cfg["dmax"], rng)
			var length := _between(cfg["lmin"], cfg["lmax"], rng)
			var delay := _between(0.0, dur, rng)
			bolts.append({"side": side, "top_pct": top, "dur_s": dur, "length": length, "delay_s": delay,
				"segments": bolt_segments(length, rng)})
	return bolts

## web boltSVG: a jagged line across the box from mid-height to a jittered end, as [{"from", "to", "width"}]
## in box pixels (the box is `length` wide and BOX_HEIGHT tall).
static func bolt_segments(length: float, rng: Callable) -> Array:
	var segments := []
	var mid := BOX_HEIGHT * HALF
	var end_y: float = mid + (rng.call() * SPREAD - 1.0) * END_JITTER_PX
	jag(Vector2(0.0, mid), Vector2(length, end_y), length * START_DISP_SHARE, STROKE_WIDTH, segments, rng)
	return segments

## web jag: midpoint displacement down to MIN_DISP, forking off thick branches.
static func jag(from: Vector2, to: Vector2, disp: float, width: float, out: Array, rng: Callable) -> void:
	if disp < MIN_DISP:
		out.append({"from": from, "to": to, "width": width})
		return
	var delta := to - from
	var length := delta.length()
	if length == 0.0:
		length = 1.0
	var off: float = (rng.call() * SPREAD - 1.0) * disp
	var middle := (from + to) * HALF + Vector2(-delta.y, delta.x) / length * off
	jag(from, middle, disp * HALF, width, out, rng)
	jag(middle, to, disp * HALF, width, out, rng)
	if width > FORK_MIN_WIDTH and rng.call() < FORK_CHANCE:
		var sign := -1.0 if rng.call() < HALF else 1.0
		var angle: float = atan2(delta.y, delta.x) + sign * (FORK_ANGLE_MIN + rng.call() * FORK_ANGLE_GAIN)
		var branch: float = length * (FORK_LENGTH_MIN + rng.call() * FORK_LENGTH_GAIN)
		jag(middle, middle + Vector2(cos(angle), sin(angle)) * branch, disp * HALF, width * FORK_WIDTH_SHARE, out, rng)

## Screen position of a box point: left bolts sit at -2px, right bolts are mirrored against the right edge.
static func to_screen(bolt: Dictionary, point: Vector2, screen: Vector2) -> Vector2:
	var top: float = bolt["top_pct"] / PERCENT * screen.y - BOX_HEIGHT * HALF
	if bolt["side"] == SIDE_LEFT:
		return Vector2(-EDGE_OUTSET_PX + point.x, top + point.y)
	return Vector2(screen.x + EDGE_OUTSET_PX - point.x, top + point.y)

## ov-pulse: the vignette opacity 0.8 <-> 1 over the tier's period (ease-in-out per half).
static func pulse_opacity(elapsed_s: float, period_s: float) -> float:
	return CssTiming.sample(PULSE_KEYS, CssTiming.cycle_fraction(elapsed_s, period_s), CssTiming.EASE_IN_OUT)

## ov-strike: a bolt's flicker; before its delay the base .ov-bolt opacity 0 holds.
static func strike_opacity(elapsed_s: float, dur_s: float, delay_s: float) -> float:
	var fraction := CssTiming.cycle_fraction(elapsed_s, dur_s, delay_s)
	if fraction < 0.0:
		return 0.0
	return CssTiming.sample(STRIKE_KEYS, fraction, CssTiming.EASE)

## The vignette's inset box-shadow for a tier: {"color", "blur_px", "spread_px"}.
static func vignette_shadow(tier: String) -> Dictionary:
	var cfg: Dictionary = TIERS[tier]
	return {"color": Color(GLOW_RGB, cfg["a"]), "blur_px": cfg["r"], "spread_px": cfg["r"] * SPREAD_SHARE}

static func _between(from: float, to: float, rng: Callable) -> float:
	return from + rng.call() * (to - from)
