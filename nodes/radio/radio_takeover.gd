class_name RadioTakeover extends Node3D
## The Radio screen's in-scene takeover — port of web RadioTakeover inside the menu backdrop: each frame after the camera
## rig, the beat (RadioBeatClock — the backdrop keeps it across visits, like the web's module-level state) drives the
## camera punch (RadioCameraPunch) and the emoji rain (RadioEmojiRain) on the same frame; the rain follows the punched
## camera.

var random := func() -> float: return randf()

var _punch := RadioCameraPunch.new()
var _rain: RadioEmojiRain

func _init() -> void:
	name = "RadioTakeover"
	_rain = RadioEmojiRain.new()
	add_child(_rain)

func rain() -> RadioEmojiRain:
	return _rain

func punch() -> RadioCameraPunch:
	return _punch

## One frame: `bands` the low-to-high spectrum, `bpm` / `mood` the track's, `level` the audio level, `aspect` the view's.
func step(dt: float, beat: RadioBeatClock, camera: Camera3D, aspect: float, bands: PackedFloat32Array, bpm: float,
		mood: String, level: float) -> void:
	beat.step(dt, bands, bpm)
	_punch.step(dt, beat.fired, beat.strength)
	camera.global_position += _punch.offset(-camera.global_basis.z, random)
	_rain.random = random
	_rain.set_mood(mood)
	_rain.step(dt, camera, aspect, beat.fired, beat.strength, level)
