extends SceneTree
## Probe (2026-09-15): the free trial's generation gate on the live engine page. The gate closes before `init` (a spent
## daily quota), the engine warms up and is told to resume — no track may be generated and the controller must not
## run; then the gate opens and `resume` restarts it (the DLC bought / a new day) — a track is generated and runs.
## Nearly silent (volume 0.001). Writes test-results/probes/radio_gate/summary.json.
##   Godot.exe --path . --resolution 640x360 -s tools/probes/radio_gate_probe.gd

const OUT_DIR := "res://test-results/probes/radio_gate"
const CLOSED_S := 10.0                          # after the engine is ready, with the gate closed
const OPEN_S := 10.0                            # after the gate opens
const WARMUP_LIMIT_S := 30.0
const POLL_S := 1.0
const PROBE_VOLUME := 0.001
const READY := "ready"

var _host: RadioHost
var _phase := "warmup"
var _generated := {"warmup": 0, "closed": 0, "open": 0}
var _running := {"warmup": false, "closed": false, "open": false}
var _states := {"warmup": 0, "closed": 0, "open": 0}
var _engine_ready := false

func _initialize() -> void:
	if not WebViewRadioTransport.available():
		print("radio gate probe: no WebView here")
		quit(1)
		return
	var transport := WebViewRadioTransport.new()
	transport.attach(root)
	_host = RadioHost.new(transport)
	_host.init_state_changed.connect(func(state: String) -> void: _engine_ready = _engine_ready or state == READY)
	_host.generated.connect(func() -> void: _generated[_phase] += 1)
	_host.state_changed.connect(func(_state: Dictionary) -> void: _states[_phase] += 1)
	_host.progress_changed.connect(func(_progress: float, _total_ms: float, running: bool, _bars: float) -> void:
		_running[_phase] = _running[_phase] or running)
	_host.set_gate(false)
	_host.init(PROBE_VOLUME)
	_run()

func _run() -> void:
	var waited := 0.0
	while not _engine_ready and waited < WARMUP_LIMIT_S:
		await create_timer(POLL_S).timeout
		waited += POLL_S
	_phase = "closed"
	_host.resume()
	await create_timer(CLOSED_S).timeout
	_phase = "open"
	_host.set_gate(true)
	_host.resume()
	await create_timer(OPEN_S).timeout
	var summary := {"engine_ready": _engine_ready, "generated": _generated, "running": _running, "states": _states}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	var file := FileAccess.open(OUT_DIR + "/summary.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(summary, "  "))
	file.close()
	print("radio gate probe: %s" % JSON.stringify(summary))
	quit()
