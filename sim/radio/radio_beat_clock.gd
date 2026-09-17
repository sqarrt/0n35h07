class_name RadioBeatClock extends RefCounted
## The Radio takeover's beat — port of web RadioTakeover BeatClock: a tempo grid ticking every 60 / bpm seconds that a
## clear low-band onset pulls into phase, firing on a low-band onset (the rise of bands 0 + 1 above ONSET_FLUX) that lands
## within WINDOW_FRAC of an interval from a grid tick and REFRACTORY_FRAC of an interval after the last beat. A kick is a
## transient: a drone or silence has no flux and never fires, while every on-grid kick does, its strength the flux over
## FLUX_FULL. Runs before the camera and the emoji read `fired` and `strength`.

const SECONDS_PER_MINUTE := 60.0
const MIN_BPM := 60.0                           # web RADIO_BEAT_MIN_BPM: a missing or zero bpm
const ONSET_FLUX := 0.035                       # web RADIO_BEAT_ONSET_FLUX
const PLL_FLUX := 0.09                          # web RADIO_BEAT_PLL_FLUX: only strong kicks move the phase
const PLL_GAIN := 0.2                           # web RADIO_BEAT_PLL_GAIN
const WINDOW_FRAC := 0.26                       # web RADIO_BEAT_WINDOW_FRAC
const FLUX_FULL := 0.35                         # web RADIO_BEAT_FLUX_FULL: strength 1
const REFRACTORY_FRAC := 0.4                    # web RADIO_BEAT_REFRACTORY_FRAC
const MAX_DT := 0.1                             # web Math.min(dtRaw, 0.1)
const KICK_BANDS := 2                           # bands 0 and 1 make the kick
const HALF := 0.5

var fired := false                              # a hit this frame
var strength := 0.0                             # its loudness 0..1

var _phase := 0.0                               # time since the last grid tick
var _since_beat := 0.0
var _prev_kick := 0.0

## One frame: `bands` the low-to-high spectrum 0..1 (missing bands count as 0), `bpm` the track's tempo.
func step(dt: float, bands: PackedFloat32Array, bpm: float) -> void:
	var clamped := minf(dt, MAX_DT)
	var interval := SECONDS_PER_MINUTE / maxf(MIN_BPM, bpm)
	var kick := 0.0
	for i in mini(KICK_BANDS, bands.size()):
		kick += bands[i]
	var flux := maxf(0.0, kick - _prev_kick)
	_prev_kick = kick
	var distance_to_tick := minf(_phase, interval - _phase)   # before the nudge
	if flux > PLL_FLUX:
		var error := _phase - interval if _phase > interval * HALF else _phase
		_phase -= error * PLL_GAIN
	_phase += clamped
	if _phase >= interval:
		_phase -= interval
	_since_beat += clamped
	fired = false
	if flux > ONSET_FLUX and distance_to_tick < interval * WINDOW_FRAC and _since_beat > interval * REFRACTORY_FRAC:
		_since_beat = 0.0
		fired = true
		strength = minf(1.0, flux / FLUX_FULL)

func phase() -> float:
	return _phase
