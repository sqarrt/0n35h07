extends SceneTree
## Probe (2026-09-15): the radio bridge end to end — WebViewRadioTransport loads the built host
## (res://localhost/radio_host/, web-reference vite.radio-host.config.ts), RadioHost queues `init` until the page is
## ready and resumes once the engine is — does Strudel warm up, does a track start and run, does the meter move?
## Nearly silent (volume 0.001). Writes the raw events to test-results/probes/radio_host/events.json and a summary.
##   Godot.exe --path . --resolution 640x360 -s tools/probes/radio_host_probe.gd

const OUT_DIR := "res://test-results/probes/radio_host"
const RUN_S := 25.0
const PROBE_VOLUME := 0.001
const READY := "ready"

var _host: RadioHost
var _events: Array = []
var _started_ms := 0
var _first_state := {}
var _progress: Array = []
var _max_level := 0.0
var _generated := 0

func _initialize() -> void:
	if not WebViewRadioTransport.available():
		print("radio host probe: no WebView here")
		quit(1)
		return
	var transport := WebViewRadioTransport.new()
	transport.received.connect(_log)
	transport.attach(root)
	_host = RadioHost.new(transport)
	_host.init_state_changed.connect(_on_init_state)
	_host.state_changed.connect(func(state: Dictionary) -> void:
		if _first_state.is_empty():
			_first_state = state
			print("radio host probe: first state at %d ms: mood %s key %s %s bpm %s track %s" % [_elapsed(),
				state.get("mood"), state.get("key"), state.get("scaleName"), state.get("bpm"), state.get("trackSeed")]))
	_host.progress_changed.connect(func(progress: float, total_ms: float, running: bool, _bars: float) -> void:
		_progress.append([snappedf(progress, 0.0001), total_ms, running]))
	_host.meter_changed.connect(func(level: float, _bands: PackedFloat32Array, _vis_bands: PackedFloat32Array) -> void:
		_max_level = maxf(_max_level, level))
	_host.generated.connect(func() -> void: _generated += 1)
	_host.init(PROBE_VOLUME)   # queued: the page is not loaded yet
	_started_ms = Time.get_ticks_msec()
	_finish()

func _elapsed() -> int:
	return Time.get_ticks_msec() - _started_ms

func _log(text: String) -> void:
	var event := RadioProtocol.parse_event(text)
	if not event.is_empty():
		event["ms"] = _elapsed()
		_events.append(event)

func _on_init_state(state: String) -> void:
	print("radio host probe: init-state %s at %d ms" % [state, _elapsed()])
	if state == READY:
		_host.resume()

func _finish() -> void:
	await create_timer(RUN_S).timeout
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	var file := FileAccess.open(OUT_DIR + "/events.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(_events, "  "))
	file.close()
	print("radio host probe: page ready %s, events %d, generated %d" % [_host.is_page_ready(), _events.size(), _generated])
	if not _progress.is_empty():
		print("radio host probe: progress first %s last %s" % [_progress.front(), _progress.back()])
	print("radio host probe: max meter level %.4f" % _max_level)
	quit()
