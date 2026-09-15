class_name AudioAnalysisHub extends RefCounted
## One level and spectrum for everything that sounds — port of web AudioAnalysis: one analyser per source (web: one per
## AudioContext) fed from its bus capture, the bands max-combined across sources and the level taken as the loudest.
## A capture is duck-typed: get_frames_available() -> int, get_buffer(frames) -> PackedVector2Array.

const BYTES := "bytes"                   # a source's last frequency read

var _sources := []                       # [{"capture", "analyser"}]
var _readers: Array[Callable] = []       # level sources without a bus (web addReader: the radio page's meter)
var _band_readers: Array[Callable] = []  # spectrum sources without a bus (web addBandReader): reader(out) max-combines
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

## A level read each update (0..1 after its own scaling) that joins the loudest-source maximum.
func add_level_reader(reader: Callable) -> void:
	if not _readers.has(reader):
		_readers.append(reader)

func remove_level_reader(reader: Callable) -> void:
	_readers.erase(reader)

## A spectrum read each update that max-combines itself into the bands it is given (web addBandReader).
func add_band_reader(reader: Callable) -> void:
	if not _band_readers.has(reader):
		_band_readers.append(reader)

func remove_band_reader(reader: Callable) -> void:
	_band_readers.erase(reader)

## `out` (any band count) filled with this update's spectrum — web analysis.bands(out): every source's last read split
## into out's bands and max-combined (the analysers are not read again: a read is a smoothing step).
func fill_bands(out: PackedFloat32Array) -> void:
	out.fill(0.0)
	for source in _sources:
		if source.has(BYTES):
			AudioAnalyser.fill_bands(source[BYTES], out)
	for reader in _band_readers:
		reader.call(out)

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
		var bytes := analyser.frequency_bytes()
		source[BYTES] = bytes
		AudioAnalyser.fill_bands(bytes, _bands)
		_level = maxf(_level, analyser.level())
	for reader in _readers:
		_level = maxf(_level, float(reader.call()))
	for reader in _band_readers:
		reader.call(_bands)

func bands() -> PackedFloat32Array:
	return _bands

func level() -> float:
	return clampf(_level, 0.0, 1.0)
