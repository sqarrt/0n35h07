extends GutTest
## RadioProtocol — the JSON messages between Godot and the radio host page (web-reference src/radio/host/hostProtocol.ts):
## command names and fields exactly as the page parses them, events read back only when well-formed.

const EPS := 0.0001
const VOLUME := 0.64
const FRAC := 0.25
const SEED := "abc"
const INDEX := 3
const BAKED := {"name": "Iron Verdict", "bpm": 128.0, "bars": 64.0,   # JSON numbers come back as floats
	"info": {"mood": "dark", "key": "E", "scale": "phrygian"}, "program": "silence"}

func _decode(text: String) -> Dictionary:
	var json := JSON.new()
	assert_eq(json.parse(text), OK, text)
	return json.data

func test_commands_carry_the_pages_names_and_fields() -> void:
	assert_eq(_decode(RadioProtocol.init_command(VOLUME)), {"cmd": "init", "volume": VOLUME})
	for pair in [[RadioProtocol.RESUME, "resume"], [RadioProtocol.PAUSE, "pause"], [RadioProtocol.STOP, "stop"],
			[RadioProtocol.NEXT, "next"], [RadioProtocol.PREV, "prev"], [RadioProtocol.RESUME_GENERATIVE, "resume-generative"]]:
		assert_eq(_decode(RadioProtocol.command(pair[0])), {"cmd": pair[1]})
	assert_eq(_decode(RadioProtocol.seek_command(FRAC)), {"cmd": "seek", "frac": FRAC})
	assert_eq(_decode(RadioProtocol.volume_command(VOLUME)), {"cmd": "volume", "value": VOLUME})
	assert_eq(_decode(RadioProtocol.gate_command(false)), {"cmd": "gate", "canGenerate": false})
	var track := _decode(RadioProtocol.play_track_command(SEED, INDEX))
	assert_eq(track["cmd"], "play-track")
	assert_eq(track["seed"], SEED)
	assert_almost_eq(float(track["index"]), float(INDEX), EPS)
	assert_eq(_decode(RadioProtocol.play_baked_command(BAKED))["track"], BAKED)

func test_events_are_read_only_when_well_formed() -> void:
	assert_eq(RadioProtocol.parse_event('{"event":"ready"}'), {"event": "ready"})
	var progress := RadioProtocol.parse_event('{"event":"progress","progress":0.5,"totalMs":180000,"running":true}')
	assert_eq(progress["event"], RadioProtocol.EVENT_PROGRESS)
	for junk in ["not json", "null", "[]", "{}", '{"event":7}', '{"cmd":"resume"}']:
		assert_eq(RadioProtocol.parse_event(junk), {}, junk)
