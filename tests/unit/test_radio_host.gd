extends GutTest
## RadioHost — Godot's side of the radio page: commands wait for the page's `ready` (a message posted before the page
## loads is lost), then go straight through; the page's events come back as signals; junk is ignored.

const VOLUME := 0.5
const BANDS := [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
const VIS_BAND_COUNT := 24

class FakeTransport extends RadioTransport:
	var sent: Array[String] = []

	func send(text: String) -> void:
		sent.append(text)

	func deliver(text: String) -> void:
		received.emit(text)

func _host() -> Array:
	var transport := FakeTransport.new()
	return [RadioHost.new(transport), transport]

func test_commands_wait_for_the_page_then_flush_in_order() -> void:
	var parts := _host()
	var host: RadioHost = parts[0]
	var transport: FakeTransport = parts[1]
	host.init(VOLUME)
	host.resume()
	assert_eq(transport.sent.size(), 0, "the page is not loaded yet")
	watch_signals(host)
	transport.deliver('{"event":"ready"}')
	assert_signal_emitted(host, "page_ready")
	assert_eq(transport.sent, [RadioProtocol.init_command(VOLUME), RadioProtocol.command(RadioProtocol.RESUME)])
	host.pause()
	assert_eq(transport.sent.back(), RadioProtocol.command(RadioProtocol.PAUSE), "straight through once ready")

func test_events_become_signals() -> void:
	var parts := _host()
	var host: RadioHost = parts[0]
	var transport: FakeTransport = parts[1]
	watch_signals(host)
	transport.deliver('{"event":"init-state","state":"ready"}')
	assert_signal_emitted_with_parameters(host, "init_state_changed", ["ready"])
	transport.deliver('{"event":"state","state":{"mood":"dark","bpm":128}}')
	assert_signal_emitted_with_parameters(host, "state_changed", [{"mood": "dark", "bpm": 128.0}])   # JSON numbers: floats
	transport.deliver('{"event":"progress","progress":0.25,"totalMs":180000,"running":true}')
	assert_signal_emitted_with_parameters(host, "progress_changed", [0.25, 180000.0, true])
	var vis := []
	vis.resize(VIS_BAND_COUNT)
	vis.fill(0.25)
	transport.deliver(JSON.stringify({"event": "meter", "level": 0.5, "bands": BANDS, "visBands": vis}))
	assert_signal_emitted(host, "meter_changed")
	var meter: Array = get_signal_parameters(host, "meter_changed")
	assert_almost_eq(float(meter[0]), 0.5, 0.0001)
	var bands: PackedFloat32Array = meter[1]   # `as` does not cast packed arrays
	assert_eq(bands.size(), BANDS.size())
	var vis_bands: PackedFloat32Array = meter[2]
	assert_eq(vis_bands.size(), VIS_BAND_COUNT, "the visualizer's 24 bands")
	transport.deliver(JSON.stringify({"event": "meter", "level": 0.5, "bands": BANDS}))
	assert_eq((get_signal_parameters(host, "meter_changed")[2] as PackedFloat32Array).size(), 0, "an older page sends none")
	transport.deliver('{"event":"track-end"}')
	assert_signal_emitted(host, "track_ended")
	transport.deliver('{"event":"generated"}')
	assert_signal_emitted(host, "generated")

func test_junk_from_the_page_is_ignored() -> void:
	var parts := _host()
	var host: RadioHost = parts[0]
	var transport: FakeTransport = parts[1]
	watch_signals(host)
	for junk in ["garbage", '{"event":"launch"}', '{"event":"progress","progress":"half"}']:
		transport.deliver(junk)
	assert_signal_not_emitted(host, "progress_changed")
	assert_signal_not_emitted(host, "page_ready")
