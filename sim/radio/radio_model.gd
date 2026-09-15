class_name RadioModel extends RefCounted
## The radio as the player shows it — web App radio state: the engine's warmup (RadioInitState), the track playing
## (MusicalState) with its label and "BPM · key scale" subtitle, and the play position. Fed by RadioHost's events.

signal changed

const NO_TRACK := "—"                         # web radioTrackLabel before any track
const INIT_IDLE := "idle"
const INIT_READY := "ready"
const SUBTITLE := "%s BPM · %s %s"            # web radioSubtitle

var init_state := INIT_IDLE
var musical_state := {}
var progress := 0.0
var total_ms := 0.0
var running := false
var bars := 0.0                               # the audible track's length in bars (web controller.currentBars)
var meter_level := 0.0                        # the page's output level (web engine.readLevel), ~30 Hz
var meter_bands := PackedFloat32Array()       # its 8 bands (web engine.readBands)
var meter_vis_bands := PackedFloat32Array()   # its 24 bands for the LIBRARY visualizer

func bind(host: RadioHost) -> void:
	host.init_state_changed.connect(func(state: String) -> void:
		init_state = state
		changed.emit())
	host.state_changed.connect(func(state: Dictionary) -> void:
		musical_state = state
		changed.emit())
	host.progress_changed.connect(func(value: float, total: float, is_running: bool, track_bars: float) -> void:
		progress = value
		total_ms = total
		running = is_running
		bars = track_bars
		changed.emit())
	host.meter_changed.connect(func(level: float, bands: PackedFloat32Array, vis_bands: PackedFloat32Array) -> void:
		meter_level = level                     # read each frame, no signal
		meter_bands = bands
		meter_vis_bands = vis_bands)

func is_ready() -> bool:
	return init_state == INIT_READY

## The play position before the page confirms it (web radioSeek: the bar jumps at once instead of snapping back).
func set_progress(fraction: float) -> void:
	progress = fraction
	changed.emit()

## A baked favorite keeps its frozen name, a live track derives one, and before any track: "—".
func track_label() -> String:
	if musical_state.is_empty():
		return NO_TRACK
	if musical_state.get("name") is String:
		return musical_state["name"]
	return RadioTrackName.of(str(musical_state.get("mood", "")), float(musical_state.get("bpm", 0.0)),
		str(musical_state.get("key", "")), str(musical_state.get("trackSeed", "")))

func subtitle() -> String:
	if musical_state.is_empty():
		return ""
	return SUBTITLE % [RadioTrackName.number_text(float(musical_state.get("bpm", 0.0))), musical_state.get("key", ""),
		musical_state.get("scaleName", "")]
