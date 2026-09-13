class_name RageJaws extends RefCounted
## The "rage" windup hologram — port of web RageWindupFx jaws: two horseshoe arcs of six triangular teeth hanging in
## front of the ball along the flat aim, opening with the charge and snapping shut after the shot, fading in, with rare
## capped-rate glitch jerks (offset + opacity dip).

const TEETH := 6
const WIDTH := MoveConst.BALL_RADIUS * 4.7
const TOOTH_LEN := MoveConst.BALL_RADIUS * 1.5
const TOOTH_LEN_VAR := 0.35
const TOOTH_WIDTH := WIDTH / TEETH * 0.85
const ARCH := MoveConst.BALL_RADIUS * 0.75
const CURVE := MoveConst.BALL_RADIUS * 1.2
const EDGE_YAW := 0.6
const GAP := MoveConst.BALL_RADIUS * 0.33
const DISTANCE := MoveConst.BALL_RADIUS * 1.8
const OPEN_DIST := MoveConst.BALL_RADIUS * 2.8
const OPEN_RAD := 0.85
const OPACITY := 0.4
const COLOR := Color("#e8f4ff")
const APPEAR_FRAC := 0.15
const SNAP_FRAC := 0.3
const GLITCH_INTERVAL_MS := 160.0
const GLITCH_CHANCE := 0.45
const GLITCH_DURATION_MS := 70.0
const GLITCH_SHIFT := MoveConst.BALL_RADIUS * 0.25
const GLITCH_OPACITY_DROP := 0.55
const LOWER_PATTERN_SHIFT := 3               # the lower jaw uses its own ragged pattern
const TOOTH_HASH := 12.9898
const HALF := 0.5
const SPREAD := 2.0

var glitch_offset := Vector3.ZERO
var _glitch_timer_ms := 0.0
var _glitch_cooldown_ms := GLITCH_INTERVAL_MS   # the first coin flip only after a full interval

## Deterministic ragged length factor per tooth index (web toothVar).
static func tooth_variation(i: int) -> float:
	return 1.0 - TOOTH_LEN_VAR * (HALF + HALF * sin(i * TOOTH_HASH))

## Tooth `i` of the upper or lower jaw: {"position" (jaw-local), "yaw", "length" (signed: up teeth point down),
## "half_width"}; the triangle is (-half_width, 0, 0), (half_width, 0, 0), (0, length, 0).
static func tooth(upper: bool, i: int) -> Dictionary:
	var t := float(i) / (TEETH - 1)
	var bow := 1.0 - pow(2.0 * t - 1.0, 2.0)
	var arch := ARCH * bow
	var side := 1.0 if upper else -1.0
	var length := TOOTH_LEN * tooth_variation(i + (0 if upper else LOWER_PATTERN_SHIFT))
	return {"position": Vector3((t - HALF) * WIDTH, (GAP * HALF + arch) * side, CURVE * bow),
		"yaw": -(2.0 * t - 1.0) * EDGE_YAW, "length": -length if upper else length, "half_width": TOOTH_WIDTH * HALF}

static func active(progress: float, shrink: float) -> bool:
	return progress > 0.0 or shrink < 1.0

## Mouth opening 0..1: grows with the charge, snaps shut over the first 30% of the deflate.
static func open_amount(progress: float, shrink: float) -> float:
	return progress if progress > 0.0 else maxf(0.0, 1.0 - shrink / SNAP_FRAC)

## Fade-in over the first 15% of the charge; dissolves with the deflate.
static func appear(progress: float, shrink: float) -> float:
	return minf(progress / APPEAR_FRAC, 1.0) if progress > 0.0 else 1.0 - shrink

static func opacity(appear_k: float, glitching: bool) -> float:
	return OPACITY * appear_k * (GLITCH_OPACITY_DROP if glitching else 1.0)

## Advance the glitch clock; true while a jerk is showing (then `glitch_offset` applies).
func step_glitch(dt: float, rng: Callable) -> bool:
	var ms := dt * SkinCurves.MS_PER_S
	_glitch_timer_ms = maxf(0.0, _glitch_timer_ms - ms)
	_glitch_cooldown_ms -= ms
	if _glitch_cooldown_ms <= 0.0:
		_glitch_cooldown_ms = GLITCH_INTERVAL_MS
		if rng.call() < GLITCH_CHANCE:
			_glitch_timer_ms = GLITCH_DURATION_MS
			glitch_offset = Vector3((rng.call() - HALF) * SPREAD * GLITCH_SHIFT, (rng.call() - HALF) * GLITCH_SHIFT, 0.0)
	return _glitch_timer_ms > 0.0
