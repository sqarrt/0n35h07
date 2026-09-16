extends SceneTree
## Probe: does the radio's meter level (what the menu glow and the emoji rain pulse to) follow the volume slider?
## One track, two volume windows, the mean and max level of each. The page compensates its post-gain analyser tap
## back to VIS_REF_LEVEL (web StrudelWebEngine.#visGain), so both windows should read about the same.
##   Godot.exe --path . --resolution 640x360 -s tools/probes/radio_volume_level_probe.gd

const WARM_S := 22.0
const WINDOW_S := 12.0
const LOUD := 0.30
const QUIET := 0.10
const READY := "ready"

var _host: RadioHost
var _levels: Array[float] = []
var _collect := false

func _initialize() -> void:
	if not WebViewRadioTransport.available():
		print("PROBE: no WebView here")
		quit(1)
		return
	var transport := WebViewRadioTransport.new()
	transport.attach(root)
	_host = RadioHost.new(transport)
	_host.init_state_changed.connect(func(state: String) -> void:
		if state == READY:
			_host.resume())
	_host.meter_changed.connect(func(level: float, _bands: PackedFloat32Array, _vis: PackedFloat32Array) -> void:
		if _collect:
			_levels.append(level))
	_host.init(LOUD)
	_run()

func _stats(label: String, volume: float) -> void:
	_host.set_volume(volume)
	_levels.clear()
	_collect = true
	await create_timer(WINDOW_S).timeout
	_collect = false
	var total := 0.0
	var top := 0.0
	for level in _levels:
		total += level
		top = maxf(top, level)
	var mean := total / maxf(1.0, float(_levels.size()))
	print("PROBE %s volume=%.2f samples=%d mean=%.4f max=%.4f" % [label, volume, _levels.size(), mean, top])

func _run() -> void:
	await create_timer(WARM_S).timeout
	await _stats("loud", LOUD)
	await _stats("quiet", QUIET)
	await _stats("loud-again", LOUD)
	quit()
