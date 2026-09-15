class_name RadioVizState extends RefCounted
## The LIBRARY visualizer's frame state — web components/RadioVisualizer draw(): 24 bands smoothed (attack 0.85, release
## 0.22, or 0.035 in silence), bass / mid / high as the means of bands 0–5 / 6–14 / 15–23, the bass envelope and its
## impulse (decay 0.84, gain 4.5), the level and the phase; AUTO shows scope, bars, radial and field for 18 s of frames
## each. The particle field — 90 points drifting 0.0004–0.001 of the canvas a frame — is drawn from `random`
## (Math.random, or a capture's seeded mulberry32). A pinned frame (web __debugVizPin) takes the smoothed bands, level,
## impulse, phase and frame as given and holds the field still.

const BANDS := 24
const FIELD_N := 90
const BASS_END := 6
const MID_END := 15
const SILENT_LEVEL := 0.015
const SILENT_BANDS := 0.4
const LEVEL_RATE := 0.4
const LEVEL_SILENT_RATE := 0.04
const ATTACK := 0.85
const RELEASE := 0.22
const SILENT_RELEASE := 0.035
const ENVELOPE_ATTACK := 0.35
const ENVELOPE_RELEASE := 0.05
const IMPULSE_DECAY := 0.84
const IMPULSE_GAIN := 4.5
const PHASE_STEP := 0.006
const PHASE_BASS := 0.03
const PHASE_MID := 0.022
const PHASE_HIGH := 0.014
const PHASE_IMPULSE := 0.07
const TURN := 6.283                             # web's 2π for a particle's heading
const SPEED_MIN := 0.0004
const SPEED_RANGE := 0.0006
const FIELD_SPEED_IMPULSE := 6.0
const AUTO := "auto"
const CONCRETE := ["scope", "bars", "radial", "field"]
const ROTATE_FRAMES := 60 * 18                  # web VIZ_ROTATE_FRAMES
const PIN_PHASE := "phase"
const PIN_FRAME := "frame"
const PIN_LEVEL := "level"
const PIN_IMPULSE := "impulse"
const PIN_BANDS := "bands"
const PIN_SEED := "seed"

var smooth := PackedFloat32Array()
var level := 0.0
var bass := 0.0
var mid := 0.0
var high := 0.0
var energy := 0.0
var impulse := 0.0
var phase := 0.0
var frame := 0
var still := false
var px := PackedFloat32Array()
var py := PackedFloat32Array()

var _envelope := 0.0
var _vx := PackedFloat32Array()
var _vy := PackedFloat32Array()

func _init(random := Callable()) -> void:
	smooth.resize(BANDS)
	var draw := random if random.is_valid() else func() -> float: return randf()
	for field in [px, py, _vx, _vy]:
		field.resize(FIELD_N)
	for i in FIELD_N:                           # web: x, y, heading, speed — in that order
		px[i] = draw.call()
		py[i] = draw.call()
		var heading: float = draw.call() * TURN
		var speed: float = SPEED_MIN + draw.call() * SPEED_RANGE
		_vx[i] = cos(heading) * speed
		_vy[i] = sin(heading) * speed

## A seeded state for a pinned frame (the pin's seed draws the field).
static func pinned(pin: Dictionary) -> RadioVizState:
	var random := Mulberry32.new(int(pin[PIN_SEED]))
	var state := RadioVizState.new(random.next)
	state.pin(pin)
	return state

## One frame of the engine's `bands` (zero when off) and `raw_level`.
func step(bands: PackedFloat32Array, raw_level: float) -> void:
	var raw_bands := 0.0
	for value in bands:
		raw_bands += value
	var silent := raw_level < SILENT_LEVEL and raw_bands < SILENT_BANDS
	level += (raw_level - level) * (LEVEL_SILENT_RATE if silent else LEVEL_RATE)
	var release := SILENT_RELEASE if silent else RELEASE
	for i in BANDS:
		var value := bands[i] if i < bands.size() else 0.0
		smooth[i] += (value - smooth[i]) * (ATTACK if value > smooth[i] else release)
	_derive()
	_envelope += (bass - _envelope) * (ENVELOPE_ATTACK if bass > _envelope else ENVELOPE_RELEASE)
	impulse = maxf(impulse * IMPULSE_DECAY, minf(1.0, maxf(0.0, bass - _envelope) * IMPULSE_GAIN))
	phase += PHASE_STEP + bass * PHASE_BASS + mid * PHASE_MID + high * PHASE_HIGH + impulse * PHASE_IMPULSE

## web __debugVizPin: the frame as given, the field still.
func pin(values: Dictionary) -> void:
	var bands: Array = values[PIN_BANDS]
	for i in BANDS:
		smooth[i] = float(bands[i]) if i < bands.size() else 0.0
	_derive()
	level = float(values[PIN_LEVEL])
	impulse = float(values[PIN_IMPULSE])
	phase = float(values[PIN_PHASE])
	frame = int(values[PIN_FRAME])
	still = true

## The mode to draw this frame (AUTO rotates), then the frame count moves on.
func take_mode(mode: String) -> String:
	var shown: String = CONCRETE[(frame / ROTATE_FRAMES) % CONCRETE.size()] if mode == AUTO else mode
	frame += 1
	return shown

## web drawField: every particle drifts, faster on the impulse, wrapping round the canvas (not while pinned).
func drift_field() -> void:
	if still:
		return
	var speed := 1.0 + impulse * FIELD_SPEED_IMPULSE
	for i in FIELD_N:
		px[i] = fposmod(px[i] + _vx[i] * speed + 1.0, 1.0)
		py[i] = fposmod(py[i] + _vy[i] * speed + 1.0, 1.0)

func _derive() -> void:
	bass = _mean(0, BASS_END)
	mid = _mean(BASS_END, MID_END)
	high = _mean(MID_END, BANDS)
	energy = bass + mid + high

func _mean(from: int, to: int) -> float:
	var sum := 0.0
	for i in range(from, to):
		sum += smooth[i]
	return sum / (to - from)
