class_name FinaleTimeline extends RefCounted
## The trailer finale's clock — port of web FinaleScene useFrame: real time drives the camera pulling back from the side
## (ease-out over 7 s) and the end at 7.5 s; the charge runs at 0.35× until its second is up, then the shot fires and
## time nearly stops (0.05×), so both beams hang in flight.

const ORB_Y := 1.0
const CENTER_Y := ORB_Y + SkinCurves.BODY_MESH_Y   # the balls' centre height
const CHARGE_DUR := 1.0                            # the charge, in slow-motion seconds
const SLOWMO_CHARGE := 0.35                        # the time scale while charging
const SLOWMO_HOLD := 0.05                          # after the shot the beams "hang"
const CAM_HEIGHT := 1.7
const CAM_Z0 := 10.5                               # the pull-back (the fighters stand ±6.5 apart: headroom)
const CAM_Z1 := 18.0
const CAM_DUR := 7.0                               # real seconds of the pull-back
const FINALE_DUR := 7.5                            # the finale ends (web onEnd)
const BEAM_REACH := 0.46                           # the beams stop 46% of the way (not met yet)
const MAX_DT := 0.05                               # web: Math.min(dtRaw, 0.05)

var real_s := 0.0
var local_s := 0.0
var fired := false
var ended := false

## One frame: the clamped real `dt`, the `charge` progress (-1 once fired), whether the shot `fire`s now, the beams'
## slowed `beam_dt` after it, and whether the finale `ended` now. Nothing moves after the end.
func step(raw_dt: float) -> Dictionary:
	var out := {"dt": 0.0, "charge": -1.0, "fire": false, "beam_dt": 0.0, "ended": false}
	if ended:
		return out
	var dt := minf(raw_dt, MAX_DT)
	out["dt"] = dt
	real_s += dt
	local_s += dt * (SLOWMO_HOLD if fired else SLOWMO_CHARGE)
	if not fired:
		out["charge"] = minf(1.0, local_s / CHARGE_DUR)
		if local_s >= CHARGE_DUR:
			fired = true
			out["fire"] = true
	else:
		out["beam_dt"] = dt * SLOWMO_HOLD
	if real_s >= FINALE_DUR:
		ended = true
		out["ended"] = true
	return out

## The camera's distance now: the pull-back eased out (1 − (1 − t)²).
func camera_z() -> float:
	var t := minf(1.0, real_s / CAM_DUR)
	return CAM_Z0 + (CAM_Z1 - CAM_Z0) * (1.0 - (1.0 - t) * (1.0 - t))
