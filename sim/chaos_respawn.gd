class_name ChaosRespawn extends RefCounted
## The "chaos" respawn skin — port of web ChaosRespawnFx: the ghost is the ball mesh jittering (amplified for the first
## 250 ms, the "tear") and flickering between two opacities at a capped rate; rebirth is a 450 ms glitch reassembly in
## four opacity steps while the jitter offset decays. Only the visual mesh moves; physics stays put.

const JITTER_MAX := 0.16
const JITTER_INTERVAL_MS := 40.0
const BREAK_MS := 250.0
const BREAK_AMP := 2.5
const GHOST_OPACITY_HI := 0.4
const GHOST_OPACITY_LO := 0.15
const FLICKER_INTERVAL_MS := 110.0
const FLICKER_CHANCE := 0.35
const REBIRTH_MS := 450.0
const REBIRTH_STEPS := 4
const REBIRTH_OPACITY_FROM := 0.4
const HALF := 0.5
const SPREAD := 2.0

var jitter := Vector3.ZERO
var _jitter_timer_ms := 0.0
var _flicker_timer_ms := 0.0
var _flicker_low := false

## The moment of death: the tear starts at once.
func on_death() -> void:
	_jitter_timer_ms = 0.0

static func is_break_phase(ghost_left: float) -> bool:
	return ghost_left > 1.0 - BREAK_MS / MatchConst.RESPAWN_GHOST_MS

static func is_rebirth(since_rebirth_ms: float) -> bool:
	return since_rebirth_ms >= 0.0 and since_rebirth_ms < REBIRTH_MS

## A ghost frame: {"offset" (mesh jitter), "opacity"}; `ghost_left` runs 1 -> 0 over the phase.
func ghost_frame(dt: float, ghost_left: float, rng: Callable) -> Dictionary:
	var ms := dt * SkinCurves.MS_PER_S
	_jitter_timer_ms -= ms
	if _jitter_timer_ms <= 0.0:
		_jitter_timer_ms = JITTER_INTERVAL_MS
		var amp := JITTER_MAX * (BREAK_AMP if is_break_phase(ghost_left) else 1.0)
		jitter = Vector3((rng.call() - HALF) * SPREAD * amp, (rng.call() - HALF) * SPREAD * amp,
			(rng.call() - HALF) * SPREAD * amp)
	_flicker_timer_ms -= ms
	if _flicker_timer_ms <= 0.0:
		_flicker_timer_ms = FLICKER_INTERVAL_MS
		_flicker_low = rng.call() < FLICKER_CHANCE
	return {"offset": jitter, "opacity": GHOST_OPACITY_LO if _flicker_low else GHOST_OPACITY_HI}

## A rebirth frame: the stepped opacity climb and the decaying offset.
func rebirth_frame(since_rebirth_ms: float) -> Dictionary:
	var k := since_rebirth_ms / REBIRTH_MS
	var step := mini(REBIRTH_STEPS - 1, floori(k * REBIRTH_STEPS))
	var level := REBIRTH_OPACITY_FROM + (1.0 - REBIRTH_OPACITY_FROM) * float(step) / (REBIRTH_STEPS - 1)
	return {"offset": jitter * (1.0 - k), "opacity": level}
