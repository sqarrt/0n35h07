class_name AudioAnalysisHub extends RefCounted
## One level and spectrum for everything that sounds — port of web AudioAnalysis: one analyser per source (web: one per
## AudioContext) fed from its bus capture, the bands max-combined across sources and the level taken as the loudest.
## A capture is duck-typed: get_frames_available() -> int, get_buffer(frames) -> PackedVector2Array.

var _sources := []                       # [{"capture", "analyser"}]
var _bands := PackedFloat32Array()
var _level := 0.0

func _init() -> void:
	_bands.resize(AudioBarModel.BANDS)

func add_capture(capture) -> void:
	if capture == null or _sources.any(func(s: Dictionary) -> bool: return s["capture"] == capture):
		return
	_sources.append({"capture": capture, "analyser": AudioAnalyser.new()})

func remove_capture(capture) -> void:
	_sources = _sources.filter(func(s: Dictionary) -> bool: return s["capture"] != capture)

func source_count() -> int:
	return _sources.size()

## Drain every capture and take one analyser read per source (web AudioBar reads once per animation frame).
func update() -> void:
	_bands.fill(0.0)
	_level = 0.0
	for source in _sources:
		var capture = source["capture"]
		var analyser: AudioAnalyser = source["analyser"]
		var available: int = capture.get_frames_available()
		if available > 0:
			analyser.push_frames(capture.get_buffer(available))
		AudioAnalyser.fill_bands(analyser.frequency_bytes(), _bands)
		_level = maxf(_level, analyser.level())

func bands() -> PackedFloat32Array:
	return _bands

func level() -> float:
	return clampf(_level, 0.0, 1.0)
