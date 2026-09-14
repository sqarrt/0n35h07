extends GutTest
## RadioModel — the radio as the player shows it (web App radio state): the engine's warmup, the track label (a baked
## favorite's frozen name, else one derived from the track, "—" before any), the "BPM · key scale" subtitle and the
## play position, all read from RadioHost's events.

const EPS := 0.0001
const LIVE := {"mood": "acid_dark", "bpm": 133.0, "key": "E", "scaleName": "hungarian_minor", "trackSeed": "F6CB94:t0"}

class FakeTransport extends RadioTransport:
	func deliver(text: String) -> void:
		received.emit(text)

## [model, transport, host] — the host is returned too: a RefCounted nobody holds is freed with its connections (in the
## game the radio autoload keeps it).
func _bound() -> Array:
	var transport := FakeTransport.new()
	var host := RadioHost.new(transport)
	var model := RadioModel.new()
	model.bind(host)
	return [model, transport, host]

func test_nothing_playing_yet() -> void:
	var model := RadioModel.new()
	assert_false(model.is_ready())
	assert_eq(model.track_label(), RadioModel.NO_TRACK, "web '—'")
	assert_eq(model.subtitle(), "")

func test_a_live_track_derives_its_name_and_subtitle() -> void:
	var parts := _bound()
	var model: RadioModel = parts[0]
	var transport: FakeTransport = parts[1]
	watch_signals(model)
	transport.deliver('{"event":"init-state","state":"ready"}')
	assert_true(model.is_ready())
	transport.deliver(JSON.stringify({"event": "state", "state": LIVE}))
	assert_eq(model.track_label(), RadioTrackName.of(LIVE["mood"], LIVE["bpm"], LIVE["key"], LIVE["trackSeed"]))
	assert_eq(model.subtitle(), "133 BPM · E hungarian_minor")
	assert_signal_emitted(model, "changed")

func test_a_baked_favorite_keeps_its_frozen_name() -> void:
	var parts := _bound()
	var model: RadioModel = parts[0]
	var baked := LIVE.duplicate()
	baked["name"] = "Iron Verdict"
	(parts[1] as FakeTransport).deliver(JSON.stringify({"event": "state", "state": baked}))
	assert_eq(model.track_label(), "Iron Verdict")

func test_the_play_position_follows_the_host() -> void:
	var parts := _bound()
	var model: RadioModel = parts[0]
	(parts[1] as FakeTransport).deliver('{"event":"progress","progress":0.21,"totalMs":101052.6,"running":true}')
	assert_almost_eq(model.progress, 0.21, EPS)
	assert_almost_eq(model.total_ms, 101052.6, EPS)
	assert_true(model.running)
