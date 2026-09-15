class_name RadioHost extends RefCounted
## Godot's side of the radio host page (spec docs/superpowers/specs/2026-09-15-godot-radio-design.md): command methods
## (RadioProtocol) that wait for the page's `ready` — a message posted before the page loads is lost — and a signal
## for each event the page posts back, checked field by field.

signal page_ready
signal init_state_changed(state: String)             # web RadioInitState: idle / loading / ready / error
signal state_changed(state: Dictionary)              # web MusicalState of the track that just started
signal progress_changed(progress: float, total_ms: float, running: bool)
signal meter_changed(level: float, bands: PackedFloat32Array, vis_bands: PackedFloat32Array)
signal track_ended
signal generated                                     # a new live track began (the trial's generation counter)

var _transport: RadioTransport
var _page_ready := false
var _pending: Array[String] = []

func _init(transport: RadioTransport) -> void:
	_transport = transport
	_transport.received.connect(_on_received)

func is_page_ready() -> bool:
	return _page_ready

func init(volume: float) -> void:
	_send(RadioProtocol.init_command(volume))

func resume() -> void:
	_send(RadioProtocol.command(RadioProtocol.RESUME))

func pause() -> void:
	_send(RadioProtocol.command(RadioProtocol.PAUSE))

func stop() -> void:
	_send(RadioProtocol.command(RadioProtocol.STOP))

func next() -> void:
	_send(RadioProtocol.command(RadioProtocol.NEXT))

func prev() -> void:
	_send(RadioProtocol.command(RadioProtocol.PREV))

func resume_generative() -> void:
	_send(RadioProtocol.command(RadioProtocol.RESUME_GENERATIVE))

func seek(frac: float) -> void:
	_send(RadioProtocol.seek_command(frac))

func set_volume(value: float) -> void:
	_send(RadioProtocol.volume_command(value))

func set_gate(can_generate: bool) -> void:
	_send(RadioProtocol.gate_command(can_generate))

func play_track(seed: String, index: int) -> void:
	_send(RadioProtocol.play_track_command(seed, index))

func play_baked(track: Dictionary) -> void:
	_send(RadioProtocol.play_baked_command(track))

func _send(text: String) -> void:
	if _page_ready:
		_transport.send(text)
	else:
		_pending.append(text)

func _on_received(text: String) -> void:
	var event := RadioProtocol.parse_event(text)
	match event.get(RadioProtocol.EVENT, ""):
		RadioProtocol.EVENT_READY:
			_page_ready = true
			for pending in _pending:
				_transport.send(pending)
			_pending.clear()
			page_ready.emit()
		RadioProtocol.EVENT_INIT_STATE:
			if event.get("state") is String:
				init_state_changed.emit(event["state"])
		RadioProtocol.EVENT_STATE:
			if event.get("state") is Dictionary:
				state_changed.emit(event["state"])
		RadioProtocol.EVENT_PROGRESS:
			if _is_number(event.get("progress")) and _is_number(event.get("totalMs")) and event.get("running") is bool:
				progress_changed.emit(float(event["progress"]), float(event["totalMs"]), event["running"])
		RadioProtocol.EVENT_METER:
			if _is_number(event.get("level")) and event.get("bands") is Array:
				var vis_bands: Array = event["visBands"] if event.get("visBands") is Array else []
				meter_changed.emit(float(event["level"]), PackedFloat32Array(event["bands"]), PackedFloat32Array(vis_bands))
		RadioProtocol.EVENT_TRACK_END:
			track_ended.emit()
		RadioProtocol.EVENT_GENERATED:
			generated.emit()

static func _is_number(value: Variant) -> bool:
	return value is float or value is int
