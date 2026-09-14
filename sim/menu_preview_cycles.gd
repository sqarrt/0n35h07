class_name MenuPreviewCycles
## The appearance screen's one-shot style previews as timelines of the milliseconds since the click — port of the web
## MenuBackdrop StageBall cycles: SHOT charges for the windup then deflates (the beam fires at the switch); RESPAWN runs
## the ghost once around a 2.6 m circle then reassembles; DASH dashes out along +X, pauses and dashes back; SHIELD holds
## its skin for 1.5 s. INF (never clicked) and everything past the end is idle.

const IDLE := "idle"
const CHARGE := "charge"
const FIRE := "fire"
const GHOST := "ghost"
const REBIRTH := "rebirth"
const OUT := "out"
const PAUSE := "pause"
const BACK := "back"
const CHARGE_MS := CombatConst.BEAM_WINDUP_MS      # web PREVIEW_CHARGE_MS = BEAM_WINDUP
const FIRE_MS := SkinCurves.WINDUP_SHRINK_MS       # web PREVIEW_FIRE_MS
const GHOST_MS := 1200.0                           # web RESPAWN_PREVIEW_GHOST_MS
const REBIRTH_MS := 500.0                          # web RESPAWN_PREVIEW_REBIRTH_MS
const CIRCLE_R := 2.6                              # web RESPAWN_CIRCLE_R
const DASH_MS := MoveConst.DASH_DURATION_MS        # web DASH_PREVIEW_MS
const DASH_PAUSE_MS := 350.0                       # web DASH_PREVIEW_PAUSE_MS
const SHIELD_MS := 1500.0                          # web SHIELD_PREVIEW_MS
const BEAM_LENGTH_RADII := 16.0                    # web PREVIEW_BEAM_LEN = BALL_RADIUS * 16
const MS_PER_S := 1000.0

## {phase, progress (charge 0..1), shrink (deflate 0..1, 1 outside it)}.
static func shot(ms: float) -> Dictionary:
	if ms >= 0.0 and ms < CHARGE_MS:
		return {"phase": CHARGE, "progress": ms / CHARGE_MS, "shrink": 1.0}
	if ms >= CHARGE_MS and ms < CHARGE_MS + FIRE_MS:
		return {"phase": FIRE, "progress": 0.0, "shrink": (ms - CHARGE_MS) / FIRE_MS}
	return {"phase": IDLE, "progress": 0.0, "shrink": 1.0}

## {phase, ghost_left (1 → 0), since_rebirth_ms (INF outside the rebirth), theta (the run's angle)}.
static func respawn(ms: float) -> Dictionary:
	if ms >= 0.0 and ms < GHOST_MS:
		return {"phase": GHOST, "ghost_left": 1.0 - ms / GHOST_MS, "since_rebirth_ms": INF, "theta": ms / GHOST_MS * TAU}
	if ms >= GHOST_MS and ms < GHOST_MS + REBIRTH_MS:
		return {"phase": REBIRTH, "ghost_left": 0.0, "since_rebirth_ms": ms - GHOST_MS, "theta": TAU}
	return {"phase": IDLE, "ghost_left": 0.0, "since_rebirth_ms": INF, "theta": 0.0}

## Where the ghost runs at `theta`: a circle through the spot, away from the camera first.
static func ghost_offset(theta: float) -> Vector3:
	return Vector3(sin(theta) * CIRCLE_R, 0.0, (cos(theta) - 1.0) * CIRCLE_R)

## The ghost runs facing along the circle.
static func ghost_facing(theta: float) -> Vector3:
	return Vector3(cos(theta), 0.0, -sin(theta))

## The honest in-game dash length.
static func dash_distance() -> float:
	return MoveConst.DASH_SPEED * DASH_MS / MS_PER_S

## {phase, offset (along +X, 0..dash_distance)}.
static func dash(ms: float) -> Dictionary:
	var distance := dash_distance()
	if ms >= 0.0 and ms < DASH_MS:
		return {"phase": OUT, "offset": minf(MoveConst.DASH_SPEED * ms / MS_PER_S, distance)}
	if ms >= DASH_MS and ms < DASH_MS + DASH_PAUSE_MS:
		return {"phase": PAUSE, "offset": distance}
	var back_ms := ms - DASH_MS - DASH_PAUSE_MS
	if back_ms >= 0.0 and back_ms < DASH_MS:
		return {"phase": BACK, "offset": maxf(distance - MoveConst.DASH_SPEED * back_ms / MS_PER_S, 0.0)}
	return {"phase": IDLE, "offset": 0.0}

static func shield_active(ms: float) -> bool:
	return ms >= 0.0 and ms < SHIELD_MS
